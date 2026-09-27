/*
 * Lampa plugin: «Детям по возрасту»
 * Picks movies, cartoons and animated series by the child's age (TMDB data).
 */
(function () {
    'use strict';

    if (window.kids_age_plugin) return;
    window.kids_age_plugin = true;

    // Plugin version: shown in the age picker title to tell dev from prod
    var VERSION = '2.0.0';

    var STORAGE_KEY = 'kids_age_last';

    // TMDB genres
    var G = {
        animation: 16,
        family: 10751,
        adventure: 12,
        fantasy: 14,
        comedy: 35,
        scifi: 878,
        // excluded for kids
        horror: 27,
        thriller: 53,
        crime: 80,
        war: 10752,
        // TV series
        tv_kids: 10762,
        tv_action: 10759,
        tv_scifi: 10765,
        tv_war: 10768,
        tv_news: 10763,
        tv_reality: 10764,
        tv_soap: 10766,
        tv_talk: 10767
    };

    var MOVIE_EXCLUDE = [G.horror, G.thriller, G.crime, G.war].join(',');

    // Studios (TMDB companies)
    var STUDIO_GHIBLI = 10342;
    var TV_EXCLUDE = [G.crime, G.tv_war, G.tv_news, G.tv_reality, G.tv_soap, G.tv_talk, G.horror].join(',');

    /*
     * Age groups.
     * cert    — maximum MPAA (US) rating for movies.
     * tvCerts — allowed US TV ratings; TMDB filters them only as a list.
     * tv      — genres for TV series.
     */
    var AGES = [
        { id: '0-6',   title: 'до 6 лет',   cert: 'G',     tv: [G.tv_kids], tvCerts: ['TV-Y', 'TV-Y7', 'TV-G'], live_action: true },
        { id: '7-9',   title: '7–9 лет',    cert: 'PG',    tv: [G.tv_kids, G.animation], tvCerts: ['TV-Y', 'TV-Y7', 'TV-G'], live_action: true },
        { id: '10-12', title: '10–12 лет',  cert: 'PG',    tv: [G.tv_kids, G.animation, G.family], tvCerts: ['TV-Y', 'TV-Y7', 'TV-G', 'TV-PG'], live_action: true },
        { id: '13-15', title: '13–15 лет',  cert: 'PG-13', tv: [G.animation, G.family, G.tv_action, G.tv_scifi], tvCerts: ['TV-Y', 'TV-Y7', 'TV-G', 'TV-PG'], live_action: true }
    ];

    function ageById(id) {
        // there used to be 0–3 and 4–6 groups; now it is a single "under 6" group
        if (id === '0-3' || id === '4-6') id = '0-6';
        for (var i = 0; i < AGES.length; i++) if (AGES[i].id === id) return AGES[i];
        return null;
    }

    function today() {
        return new Date().toISOString().slice(0, 10);
    }

    function yearsAgo(n) {
        return new Date(Date.now() - n * 365 * 86400000).toISOString().slice(0, 10);
    }

    // There are few box-office movies and kids' series for toddlers, so their window is wider
    function hitsYears(age) {
        return age.cert === 'G' ? 10 : 3;
    }

    // Allowed movie ratings as a list. certification.lte does not work here:
    // NR ("not rated") has order 0, so it lets unrated movies through.
    var MOVIE_CERTS = ['G', 'PG', 'PG-13'];

    function movieCerts(age) {
        return MOVIE_CERTS.slice(0, MOVIE_CERTS.indexOf(age.cert) + 1).join('|');
    }

    function query(base, params) {
        var parts = [];
        for (var k in params) {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') parts.push(k + '=' + params[k]);
        }
        return base + '?' + parts.join('&');
    }

    /*
     * popular — popular, top — best rated, fresh — popular in recent years,
     * latest — most recently released, box_office — by box office, hits — most votes.
     */
    var SORTS = {
        popular:    { sort_by: 'popularity.desc', 'vote_count.gte': 50 },
        top:        { sort_by: 'vote_average.desc', 'vote_count.gte': 300 },
        fresh:      { sort_by: 'popularity.desc', 'vote_count.gte': 10 },
        latest:     { sort_by: 'primary_release_date.desc', 'vote_count.gte': 3 },
        box_office: { sort_by: 'revenue.desc', 'vote_count.gte': 50 },
        hits:       { sort_by: 'vote_count.desc', 'vote_count.gte': 50 }
    };

    function freshFrom() {
        return (new Date().getFullYear() - 2) + '-01-01';
    }

    // Movies / cartoons
    function movieUrl(age, kind, sort) {
        var p = {
            include_adult: 'false',
            certification_country: 'US',
            certification: movieCerts(age),
            without_genres: MOVIE_EXCLUDE
        };

        if (kind === 'cartoons') {
            p.with_genres = G.animation;
        } else if (kind === 'ghibli') {
            p.with_companies = STUDIO_GHIBLI;
        } else {
            // live-action movies: family, but not animation
            p.with_genres = G.family;
            p.without_genres = MOVIE_EXCLUDE + ',' + G.animation;
        }

        var s = SORTS[sort];
        for (var k in s) p[k] = s[k];

        if (sort === 'fresh') {
            p['primary_release_date.gte'] = freshFrom();
            p['primary_release_date.lte'] = today();
        }

        if (sort === 'latest') p['primary_release_date.lte'] = today();

        // movies without a theatrical release (revenue 0) go to the end with this sort order
        if (sort === 'box_office') {
            p['primary_release_date.gte'] = yearsAgo(hitsYears(age));
            p['primary_release_date.lte'] = today();
        }

        return query('discover/movie', p);
    }

    // Animated series / TV series
    function tvUrl(age, kind, sort) {
        var p = {
            include_adult: 'false',
            without_genres: TV_EXCLUDE,
            certification_country: 'US',
            certification: age.tvCerts.join('|')
        };

        if (kind === 'cartoon_series') {
            // younger kids get only the "Kids" genre, older ones any animation
            p.with_genres = age.id === '10-12' || age.id === '13-15' ? String(G.animation) : G.animation + ',' + G.tv_kids;
        } else {
            // all age-appropriate series except animation
            p.with_genres = age.tv.join('|');
            p.without_genres = TV_EXCLUDE + ',' + G.animation;
        }

        var s = SORTS[sort];
        for (var k in s) p[k] = s[k];

        if (sort === 'top') p['vote_count.gte'] = 100;

        if (sort === 'fresh') {
            p['first_air_date.gte'] = freshFrom();
            p['first_air_date.lte'] = today();
        }

        // series have no box office: hits are the most-voted among those aired in recent years
        if (sort === 'hits') p['air_date.gte'] = yearsAgo(hitsYears(age));

        return query('discover/tv', p);
    }

    function sections(age) {
        var list = [
            { title: 'Мультфильмы — популярные',   url: movieUrl(age, 'cartoons', 'popular') },
            { title: 'Мультфильмы — лучшие',       url: movieUrl(age, 'cartoons', 'top') },
            { title: 'Мультфильмы — новинки',      url: movieUrl(age, 'cartoons', 'fresh') },
            { title: 'Мультфильмы — самые свежие', url: movieUrl(age, 'cartoons', 'latest') },
            { title: 'Мультфильмы — кассовые',     url: movieUrl(age, 'cartoons', 'box_office') },
            { title: 'Студия Гибли',               url: movieUrl(age, 'ghibli', 'popular') },
            { title: 'Мультсериалы — популярные',  url: tvUrl(age, 'cartoon_series', 'popular') },
            { title: 'Мультсериалы — лучшие',      url: tvUrl(age, 'cartoon_series', 'top') },
            { title: 'Мультсериалы — хиты',        url: tvUrl(age, 'cartoon_series', 'hits') }
        ];

        if (age.live_action) {
            list.push(
                { title: 'Фильмы — популярные', url: movieUrl(age, 'films', 'popular') },
                { title: 'Фильмы — лучшие',     url: movieUrl(age, 'films', 'top') },
                { title: 'Фильмы — новинки',    url: movieUrl(age, 'films', 'fresh') },
                { title: 'Фильмы — кассовые',   url: movieUrl(age, 'films', 'box_office') },
                { title: 'Сериалы — популярные', url: tvUrl(age, 'series', 'popular') },
                { title: 'Сериалы — хиты',       url: tvUrl(age, 'series', 'hits') }
            );
        }

        return list;
    }

    function openList(age, item) {
        Lampa.Activity.push({
            url: item.url,
            title: item.title + ' (' + age.title + ')',
            component: 'category_full',
            source: 'tmdb',
            card_type: true,
            page: 1
        });
    }

    function showSections(age) {
        Lampa.Select.show({
            title: 'Детям ' + age.title,
            items: sections(age),
            onSelect: function (item) {
                openList(age, item);
            },
            onBack: function () {
                showAges();
            }
        });
    }

    function showAges() {
        var last = Lampa.Storage.get(STORAGE_KEY, '');

        var lastAge = ageById(last);

        var items = AGES.map(function (age) {
            return {
                title: age.title,
                subtitle: 'рейтинг до ' + age.cert,
                selected: lastAge === age,
                age: age
            };
        });

        Lampa.Select.show({
            title: 'Возраст ребёнка · v' + VERSION,
            items: items,
            onSelect: function (item) {
                Lampa.Storage.set(STORAGE_KEY, item.age.id);
                showSections(item.age);
            },
            onBack: function () {
                Lampa.Controller.toggle('menu');
            }
        });
    }

    var ICON = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>' +
        '<circle cx="9" cy="10" r="1.3" fill="currentColor"/>' +
        '<circle cx="15" cy="10" r="1.3" fill="currentColor"/>' +
        '<path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
        '</svg>';

    function addMenu() {
        var item = $('<li class="menu__item selector" data-action="kids_age">' +
            '<div class="menu__ico">' + ICON + '</div>' +
            '<div class="menu__text">Детям</div>' +
            '</li>');

        item.on('hover:enter', showAges);

        $('.menu .menu__list').eq(0).append(item);
    }

    function start() {
        addMenu();
    }

    if (window.appready) start();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') start();
        });
    }

    // exported for debugging
    window.kids_age_plugin_api = { version: VERSION, ages: AGES, sections: sections, age: ageById };
})();

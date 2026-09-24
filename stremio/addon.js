/*
 * Stremio addon: «Детям по возрасту».
 * Каталоги мультфильмов, фильмов и мультсериалов по возрасту ребёнка (данные TMDB).
 */
'use strict';

var TMDB_BASE = process.env.TMDB_BASE || 'https://api.themoviedb.org/3';
var TMDB_KEY = process.env.TMDB_API_KEY || '';
var LANGUAGE = process.env.LANGUAGE || 'ru-RU';
var IMG = 'https://image.tmdb.org/t/p/';

// Жанры TMDB
var G = {
    animation: 16,
    family: 10751,
    horror: 27,
    thriller: 53,
    crime: 80,
    war: 10752,
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
var TV_EXCLUDE = [G.crime, G.tv_war, G.tv_news, G.tv_reality, G.tv_soap, G.tv_talk, G.horror].join(',');

// Те же возрастные группы, что и в плагине для Лампы.
// cert — предельный рейтинг MPAA для фильмов, tvCerts — допустимые рейтинги сериалов (США).
var AGES = [
    { id: '0-3',   title: '0–3 года',  emoji: '🍼', cert: 'G',     runtime: 80, tv: [G.tv_kids], tvCerts: ['TV-Y', 'TV-G'] },
    { id: '4-6',   title: '4–6 лет',   emoji: '🧸', cert: 'G',     tv: [G.tv_kids], tvCerts: ['TV-Y', 'TV-Y7', 'TV-G'] },
    { id: '7-9',   title: '7–9 лет',   emoji: '🚀', cert: 'PG',    tv: [G.tv_kids, G.animation], tvCerts: ['TV-Y', 'TV-Y7', 'TV-G'] },
    { id: '10-12', title: '10–12 лет', emoji: '🧭', cert: 'PG',    tv: [G.tv_kids, G.animation, G.family], tvCerts: ['TV-Y', 'TV-Y7', 'TV-G', 'TV-PG'] },
    { id: '13-15', title: '13–15 лет', emoji: '🎧', cert: 'PG-13', tv: [G.animation, G.family, G.tv_action, G.tv_scifi], tvCerts: ['TV-Y', 'TV-Y7', 'TV-G', 'TV-PG'] }
];

var DEFAULT_AGE = process.env.DEFAULT_AGE || '4-6';

// Подборки, id каталога = kids_<set>
var SETS = [
    { id: 'cartoons',       type: 'movie',  emoji: '🎨', title: 'Мультфильмы',  name: 'Мультфильмы для детей' },
    { id: 'new',            type: 'movie',  emoji: '✨', title: 'Новинки',      name: 'Новые мультфильмы', shape: 'landscape' },
    { id: 'latest',         type: 'movie',  emoji: '🆕', title: 'Свежие',       name: 'Свежие мультфильмы' },
    { id: 'cartoon_series', type: 'series', emoji: '📺', title: 'Мультсериалы', name: 'Мультсериалы' },
    { id: 'films',          type: 'movie',  emoji: '🎬', title: 'Кино',         name: 'Детское кино' },
    { id: 'series',         type: 'series', emoji: '🍿', title: 'Сериалы',      name: 'Сериалы для детей' }
];

var MOVIE_CERTS = ['G', 'PG', 'PG-13'];

// Метка возраста на постере по рейтингу США
var LABELS = { 'G': 0, 'TV-Y': 0, 'TV-G': 0, 'PG': 6, 'TV-Y7': 7, 'TV-PG': 10, 'PG-13': 12 };

function ageByTitle(title) {
    for (var i = 0; i < AGES.length; i++) if (AGES[i].title === title || AGES[i].id === title) return AGES[i];
    return null;
}

function setById(id) {
    for (var i = 0; i < SETS.length; i++) if (SETS[i].id === id) return SETS[i];
    return null;
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

function daysAgo(n) {
    return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

function manifest(base) {
    return {
        id: 'community.kids.age',
        version: '1.2.0',
        name: 'Детям по возрасту',
        description: 'Мультфильмы, фильмы и мультсериалы, подобранные по возрасту ребёнка (TMDB). Возраст выбирается в фильтре каталога.',
        logo: base + '/logo.png',
        background: base + '/background.jpg',
        resources: ['catalog'],
        types: ['movie', 'series'],
        idPrefixes: ['tt'],
        catalogs: SETS.map(function (set) {
            return {
                type: set.type,
                id: 'kids_' + set.id,
                name: set.emoji + ' ' + set.name,
                extra: [
                    { name: 'genre', options: AGES.map(function (a) { return a.title; }), isRequired: false },
                    { name: 'skip', isRequired: false }
                ]
            };
        })
    };
}

// Параметры запроса discover для подборки и возраста
function discoverParams(setId, age) {
    var p = { include_adult: 'false', sort_by: 'popularity.desc', 'vote_count.gte': 50 };

    if (setId === 'cartoons' || setId === 'films' || setId === 'new' || setId === 'latest') {
        p.certification_country = 'US';
        p['certification.lte'] = age.cert;
        p['primary_release_date.lte'] = today();
        if (age.runtime) p['with_runtime.lte'] = age.runtime;

        if (setId === 'films') {
            p.with_genres = G.family;
            p.without_genres = MOVIE_EXCLUDE + ',' + G.animation;
        } else {
            p.with_genres = G.animation;
            p.without_genres = MOVIE_EXCLUDE;
        }

        if (setId === 'new') {
            p['primary_release_date.gte'] = daysAgo(365);
            p['vote_count.gte'] = 5;
        }

        // самые последние вышедшие: по дате выхода, а не по популярности
        if (setId === 'latest') {
            p.sort_by = 'primary_release_date.desc';
            p['vote_count.gte'] = 3;
        }

        return { path: 'discover/movie', params: p };
    }

    // У сериалов TMDB фильтрует по рейтингу только списком: TV-Y|TV-G|...
    p.certification_country = 'US';
    p.certification = age.tvCerts.join('|');

    if (setId === 'cartoon_series') {
        p.with_genres = age.id === '10-12' || age.id === '13-15' ? String(G.animation) : G.animation + ',' + G.tv_kids;
        p.without_genres = TV_EXCLUDE;
    } else {
        p.with_genres = age.tv.join('|');
        p.without_genres = TV_EXCLUDE + ',' + G.animation;
    }

    return { path: 'discover/tv', params: p };
}

function tmdb(path, params) {
    var q = Object.assign({ api_key: TMDB_KEY, language: LANGUAGE }, params || {});
    var url = TMDB_BASE + '/' + path + '?' + new URLSearchParams(q).toString();

    return fetch(url).then(function (res) {
        if (!res.ok) throw new Error('TMDB ' + res.status + ' for ' + path);
        return res.json();
    });
}

function usCert(kind, d) {
    if (kind === 'movie') {
        var rel = ((d.release_dates && d.release_dates.results) || []).filter(function (r) { return r.iso_3166_1 === 'US'; })[0];
        var dates = (rel && rel.release_dates) || [];
        for (var i = 0; i < dates.length; i++) if (dates[i].certification) return dates[i].certification;
        return '';
    }

    var tv = ((d.content_ratings && d.content_ratings.results) || []).filter(function (r) { return r.iso_3166_1 === 'US'; })[0];
    return (tv && tv.rating) || '';
}

/*
 * Детали карточки одним запросом: IMDb ID (Stremio и дополнения с потоками работают с ним),
 * рейтинг США, длительность и жанры.
 */
var INFO_TTL = 24 * 3600 * 1000;
var infoCache = new Map();

function details(kind, tmdbId) {
    var key = kind + ':' + tmdbId;
    var hit = infoCache.get(key);
    if (hit && Date.now() - hit.time < INFO_TTL) return Promise.resolve(hit.value);

    var append = kind === 'movie' ? 'external_ids,release_dates' : 'external_ids,content_ratings';

    return tmdb(kind + '/' + tmdbId, { append_to_response: append }).then(function (d) {
        var value = {
            imdb: (d.external_ids && d.external_ids.imdb_id) || null,
            cert: usCert(kind, d),
            runtime: d.runtime || (d.episode_run_time || [])[0] || 0,
            seasons: d.number_of_seasons || 0,
            genres: (d.genres || []).map(function (g) { return g.name.charAt(0).toUpperCase() + g.name.slice(1); })
        };
        infoCache.set(key, { time: Date.now(), value: value });
        return value;
    }).catch(function () {
        return null;
    });
}

// Подходит ли карточка возрасту (discover иногда пропускает лишнее)
function allowed(kind, cert, age) {
    if (!cert) return true;
    if (kind === 'tv') return age.tvCerts.indexOf(cert) >= 0;
    var i = MOVIE_CERTS.indexOf(cert);
    return i >= 0 && i <= MOVIE_CERTS.indexOf(age.cert);
}

function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return n + ' ' + one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' ' + few;
    return n + ' ' + many;
}

function runtimeText(min) {
    if (!min) return '';
    var h = Math.floor(min / 60), m = min % 60;
    return ((h ? h + ' ч ' : '') + (m ? m + ' мин' : '')).trim();
}

function toMeta(entry, set, age, base) {
    var item = entry.item, info = entry.info;
    var date = item.release_date || item.first_air_date || '';
    var label = info.cert in LABELS ? LABELS[info.cert] : parseInt(age.id, 10);
    var rating = Math.round((item.vote_average || 0) * 10);
    var landscape = set.shape === 'landscape' && item.backdrop_path;
    var img = landscape ? 'w780' + item.backdrop_path : item.poster_path ? 'w342' + item.poster_path : null;

    var length = set.type === 'movie' ? runtimeText(info.runtime)
        : info.seasons ? plural(info.seasons, 'сезон', 'сезона', 'сезонов') : '';
    var line = [label + '+', length, info.genres.slice(0, 3).join(', ')].filter(Boolean).join(' · ');

    return {
        id: info.imdb,
        type: set.type,
        name: item.title || item.name,
        poster: img ? base + '/poster/' + label + '/' + rating + '/' + img : undefined,
        posterShape: landscape ? 'landscape' : 'poster',
        background: item.backdrop_path ? IMG + 'w1280' + item.backdrop_path : undefined,
        description: line + (item.overview ? '\n\n' + item.overview : ''),
        releaseInfo: date ? date.slice(0, 4) : undefined,
        runtime: length || undefined,
        genres: info.genres.length ? info.genres : undefined,
        imdbRating: item.vote_average ? item.vote_average.toFixed(1) : undefined
    };
}

// Разбор extra из URL Stremio: "genre=4–6 лет&skip=20"
function parseExtra(str) {
    var extra = {};
    if (!str) return extra;

    str.split('&').forEach(function (pair) {
        var i = pair.indexOf('=');
        if (i < 0) return;
        try {
            extra[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1));
        } catch (e) { /* битая кодировка — пропускаем */ }
    });

    return extra;
}

var PAGE_SIZE = 20;               // сколько карточек отдаём за раз
var LIST_TTL = 6 * 3600 * 1000;   // сколько держим собранный список в памяти
var lists = new Map();

/*
 * Stremio присылает skip = число уже полученных карточек. Карточки без IMDb ID
 * и с неподходящим рейтингом отбрасываются, поэтому страницы TMDB и skip не совпадают:
 * копим отфильтрованный список и отдаём из него срез [skip, skip + PAGE_SIZE).
 */
function collected(set, age, need) {
    var key = set.id + ':' + age.id;
    var list = lists.get(key);

    if (!list || Date.now() - list.time > LIST_TTL) {
        list = { time: Date.now(), entries: [], seen: new Set(), page: 0, total: 1 };
        lists.set(key, list);
    }

    var kind = set.type === 'movie' ? 'movie' : 'tv';

    function more() {
        if (list.entries.length >= need || list.page >= list.total) return Promise.resolve(list.entries);

        var d = discoverParams(set.id, age);
        d.params.page = list.page + 1;

        return tmdb(d.path, d.params).then(function (data) {
            list.page = d.params.page;
            list.total = Math.min(data.total_pages || 1, 500);

            return Promise.all((data.results || []).map(function (item) {
                return details(kind, item.id).then(function (info) {
                    return info && info.imdb && allowed(kind, info.cert, age) ? { item: item, info: info } : null;
                });
            }));
        }).then(function (entries) {
            entries.forEach(function (e) {
                if (e && !list.seen.has(e.info.imdb)) {
                    list.seen.add(e.info.imdb);
                    list.entries.push(e);
                }
            });
            return more();
        });
    }

    // запросы к одному списку выполняем по очереди
    list.busy = (list.busy || Promise.resolve()).then(more, more);
    return list.busy;
}

function catalog(type, id, extra, base) {
    var set = setById(id.replace(/^kids_/, ''));
    var age = ageByTitle(extra.genre) || ageByTitle(DEFAULT_AGE) || AGES[1];

    if (!set || set.type !== type) return Promise.resolve(null);

    var skip = parseInt(extra.skip, 10) || 0;

    return collected(set, age, skip + PAGE_SIZE).then(function (entries) {
        return {
            metas: entries.slice(skip, skip + PAGE_SIZE).map(function (e) { return toMeta(e, set, age, base); }),
            cacheMaxAge: 6 * 3600
        };
    });
}

module.exports = {
    manifest: manifest,
    catalog: catalog,
    parseExtra: parseExtra,
    discoverParams: discoverParams,
    AGES: AGES,
    SETS: SETS
};

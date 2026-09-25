/*
 * Stremio addon: «Хиты кино и сериалов».
 * Кассовые фильмы, новинки и самые обсуждаемые сериалы (данные TMDB).
 */
'use strict';

var TMDB_BASE = process.env.TMDB_BASE || 'https://api.themoviedb.org/3';
var TMDB_KEY = process.env.TMDB_API_KEY || '';
var LANGUAGE = process.env.LANGUAGE || 'ru-RU';
var IMG = 'https://image.tmdb.org/t/p/';

// Жанры TMDB для фильтра в Discover (у фильмов и сериалов списки разные)
var GENRES = {
    movie: [
        [28, 'Боевик'], [12, 'Приключения'], [35, 'Комедия'], [18, 'Драма'], [53, 'Триллер'],
        [27, 'Ужасы'], [878, 'Фантастика'], [14, 'Фэнтези'], [80, 'Криминал'], [9648, 'Детектив'],
        [10749, 'Мелодрама'], [16, 'Мультфильм'], [10751, 'Семейный'], [36, 'История'],
        [10752, 'Военный'], [99, 'Документальный'], [10402, 'Музыка'], [37, 'Вестерн']
    ],
    series: [
        [18, 'Драма'], [35, 'Комедия'], [80, 'Криминал'], [9648, 'Детектив'], [10759, 'Боевик и приключения'],
        [10765, 'Фантастика и фэнтези'], [16, 'Мультфильм'], [99, 'Документальный'], [10751, 'Семейный'],
        [10768, 'Война и политика'], [10764, 'Реалити-шоу'], [37, 'Вестерн']
    ]
};

// В подборках сериалов не нужны новости и ток-шоу
var TV_EXCLUDE = [10763, 10767].join(',');

// Подборки, id каталога = hits_<set>.
// mode: box_office — по сборам, new — популярное из недавно вышедшего, hits — по числу оценок.
var SETS = [
    { id: 'box_office', type: 'movie',  emoji: '💰', name: 'Кассовые хиты', mode: 'box_office' },
    { id: 'new_movies', type: 'movie',  emoji: '✨', name: 'Новинки кино', mode: 'new', shape: 'landscape' },
    { id: 'hit_series', type: 'series', emoji: '🔥', name: 'Хиты сериалов', mode: 'hits' },
    { id: 'new_series', type: 'series', emoji: '🆕', name: 'Новые сериалы', mode: 'new' }
];

// Метка возраста на постере по рейтингу США
var LABELS = {
    'G': 0, 'TV-Y': 0, 'TV-G': 0, 'PG': 6, 'TV-Y7': 7, 'TV-PG': 10,
    'PG-13': 12, 'TV-14': 16, 'R': 18, 'NC-17': 18, 'TV-MA': 18
};

function setById(id) {
    for (var i = 0; i < SETS.length; i++) if (SETS[i].id === id) return SETS[i];
    return null;
}

function genreByName(type, name) {
    var list = GENRES[type] || [];
    for (var i = 0; i < list.length; i++) if (list[i][1] === name) return list[i][0];
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
        id: 'community.hits.ru',
        version: '2.0.0',
        name: 'Хиты кино и сериалов',
        description: 'Кассовые фильмы, новинки кино и самые обсуждаемые сериалы (TMDB). На постерах — возраст и оценка, жанр выбирается в фильтре каталога.',
        logo: base + '/logo.png',
        background: base + '/background.jpg',
        resources: ['catalog'],
        types: ['movie', 'series'],
        idPrefixes: ['tt'],
        catalogs: SETS.map(function (set) {
            return {
                type: set.type,
                id: 'hits_' + set.id,
                name: set.emoji + ' ' + set.name,
                extra: [
                    { name: 'genre', options: GENRES[set.type].map(function (g) { return g[1]; }), isRequired: false },
                    { name: 'skip', isRequired: false }
                ]
            };
        })
    };
}

// Параметры запроса discover для подборки и жанра
function discoverParams(set, genre) {
    var p = { include_adult: 'false', sort_by: 'popularity.desc', 'vote_count.gte': 50 };
    if (genre) p.with_genres = genre;

    if (set.type === 'movie') {
        p['primary_release_date.lte'] = today();

        // больше всего собрали в прокате за последние три года
        if (set.mode === 'box_office') {
            p.sort_by = 'revenue.desc';
            p['primary_release_date.gte'] = daysAgo(3 * 365);
        }

        // популярное из вышедшего за полгода
        if (set.mode === 'new') {
            p['primary_release_date.gte'] = daysAgo(183);
            p['vote_count.gte'] = 20;
        }

        return { path: 'discover/movie', params: p };
    }

    p.without_genres = TV_EXCLUDE;

    // сборов у сериалов нет: хиты — больше всего оценок среди тех, что выходили последние три года
    if (set.mode === 'hits') {
        p.sort_by = 'vote_count.desc';
        p['air_date.gte'] = daysAgo(3 * 365);
    }

    // премьеры последнего года
    if (set.mode === 'new') {
        p['first_air_date.gte'] = daysAgo(365);
        p['first_air_date.lte'] = today();
        p['vote_count.gte'] = 20;
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
 * рейтинг США, длительность, сборы и жанры.
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
            revenue: d.revenue || 0,
            genres: (d.genres || []).map(function (g) { return g.name.charAt(0).toUpperCase() + g.name.slice(1); })
        };
        infoCache.set(key, { time: Date.now(), value: value });
        return value;
    }).catch(function () {
        return null;
    });
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

// Сборы: 1 234 567 890 → «1,2 млрд $»
function money(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + ' млрд $';
    if (n >= 1e6) return Math.round(n / 1e6) + ' млн $';
    return '';
}

// Число оценок: 12345 → «12 тыс. оценок»
function votes(n) {
    return n >= 1000 ? Math.round(n / 1000) + ' тыс. оценок' : plural(n, 'оценка', 'оценки', 'оценок');
}

function toMeta(entry, set, base) {
    var item = entry.item, info = entry.info;
    var date = item.release_date || item.first_air_date || '';
    // возраст неизвестен — на постере только оценка
    var label = info.cert in LABELS ? LABELS[info.cert] : 'x';
    var rating = Math.round((item.vote_average || 0) * 10);
    var landscape = set.shape === 'landscape' && item.backdrop_path;
    var img = landscape ? 'w780' + item.backdrop_path : item.poster_path ? 'w342' + item.poster_path : null;

    var length = set.type === 'movie' ? runtimeText(info.runtime)
        : info.seasons ? plural(info.seasons, 'сезон', 'сезона', 'сезонов') : '';
    var extra = set.mode === 'box_office' && info.revenue ? '💰 ' + money(info.revenue)
        : set.mode === 'hits' && item.vote_count ? '🔥 ' + votes(item.vote_count) : '';
    var line = [label === 'x' ? '' : label + '+', extra, length, info.genres.slice(0, 3).join(', ')]
        .filter(Boolean).join(' · ');

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

// Разбор extra из URL Stremio: "genre=Комедия&skip=20"
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
 * отбрасываются, поэтому страницы TMDB и skip не совпадают: копим отфильтрованный
 * список и отдаём из него срез [skip, skip + PAGE_SIZE).
 */
function collected(set, genre, need) {
    var key = set.id + ':' + (genre || '');
    var list = lists.get(key);

    if (!list || Date.now() - list.time > LIST_TTL) {
        list = { time: Date.now(), entries: [], seen: new Set(), page: 0, total: 1 };
        lists.set(key, list);
    }

    var kind = set.type === 'movie' ? 'movie' : 'tv';

    function more() {
        if (list.entries.length >= need || list.page >= list.total) return Promise.resolve(list.entries);

        var d = discoverParams(set, genre);
        d.params.page = list.page + 1;

        return tmdb(d.path, d.params).then(function (data) {
            list.page = d.params.page;
            list.total = Math.min(data.total_pages || 1, 500);

            return Promise.all((data.results || []).map(function (item) {
                return details(kind, item.id).then(function (info) {
                    if (!info || !info.imdb) return null;
                    // в кассовые — только то, что шло в кино (от миллиона долларов сборов)
                    if (set.mode === 'box_office' && info.revenue < 1e6) return null;
                    return { item: item, info: info };
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
    var set = setById(id.replace(/^hits_/, ''));
    if (!set || set.type !== type) return Promise.resolve(null);

    var genre = extra.genre ? genreByName(type, extra.genre) : null;
    if (extra.genre && !genre) return Promise.resolve({ metas: [] });

    var skip = parseInt(extra.skip, 10) || 0;

    return collected(set, genre, skip + PAGE_SIZE).then(function (entries) {
        return {
            metas: entries.slice(skip, skip + PAGE_SIZE).map(function (e) { return toMeta(e, set, base); }),
            cacheMaxAge: 6 * 3600
        };
    });
}

module.exports = {
    manifest: manifest,
    catalog: catalog,
    parseExtra: parseExtra,
    discoverParams: discoverParams,
    SETS: SETS
};

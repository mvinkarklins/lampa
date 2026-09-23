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

// Те же возрастные группы, что и в плагине для Лампы
var AGES = [
    { id: '0-3',   title: '0–3 года',  cert: 'G',     runtime: 80, tv: [G.tv_kids] },
    { id: '4-6',   title: '4–6 лет',   cert: 'G',     tv: [G.tv_kids] },
    { id: '7-9',   title: '7–9 лет',   cert: 'PG',    tv: [G.tv_kids, G.animation] },
    { id: '10-12', title: '10–12 лет', cert: 'PG',    tv: [G.tv_kids, G.animation, G.family] },
    { id: '13-15', title: '13–15 лет', cert: 'PG-13', tv: [G.animation, G.family, G.tv_action, G.tv_scifi] }
];

var DEFAULT_AGE = process.env.DEFAULT_AGE || '4-6';

var CATALOGS = [
    { type: 'movie',  id: 'kids_cartoons',       name: 'Детям: мультфильмы' },
    { type: 'movie',  id: 'kids_films',          name: 'Детям: фильмы' },
    { type: 'series', id: 'kids_cartoon_series', name: 'Детям: мультсериалы' },
    { type: 'series', id: 'kids_series',         name: 'Детям: сериалы' }
];

var manifest = {
    id: 'community.kids.age',
    version: '1.0.0',
    name: 'Детям по возрасту',
    description: 'Мультфильмы, фильмы и мультсериалы, подобранные по возрасту ребёнка (TMDB). Возраст выбирается в фильтре каталога.',
    resources: ['catalog'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: CATALOGS.map(function (c) {
        return {
            type: c.type,
            id: c.id,
            name: c.name,
            extra: [
                { name: 'genre', options: AGES.map(function (a) { return a.title; }), isRequired: false },
                { name: 'skip', isRequired: false }
            ]
        };
    })
};

function ageByTitle(title) {
    for (var i = 0; i < AGES.length; i++) if (AGES[i].title === title || AGES[i].id === title) return AGES[i];
    return null;
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

// Параметры запроса discover для каталога и возраста
function discoverParams(catalogId, age) {
    var p = { include_adult: 'false', sort_by: 'popularity.desc', 'vote_count.gte': 50 };

    if (catalogId === 'kids_cartoons' || catalogId === 'kids_films') {
        p.certification_country = 'US';
        p['certification.lte'] = age.cert;
        p['primary_release_date.lte'] = today();
        if (age.runtime) p['with_runtime.lte'] = age.runtime;

        if (catalogId === 'kids_cartoons') {
            p.with_genres = G.animation;
            p.without_genres = MOVIE_EXCLUDE;
        } else {
            p.with_genres = G.family;
            p.without_genres = MOVIE_EXCLUDE + ',' + G.animation;
        }

        return { path: 'discover/movie', params: p };
    }

    if (catalogId === 'kids_cartoon_series') {
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

// Stremio и дополнения с потоками работают с IMDb ID, поэтому переводим TMDB ID → IMDb ID
var imdbCache = new Map();

function imdbId(kind, tmdbId) {
    var key = kind + ':' + tmdbId;
    if (imdbCache.has(key)) return Promise.resolve(imdbCache.get(key));

    return tmdb(kind + '/' + tmdbId + '/external_ids').then(function (data) {
        var id = data.imdb_id || null;
        imdbCache.set(key, id);
        return id;
    }).catch(function () {
        return null;
    });
}

function toMeta(item, type, id) {
    var date = item.release_date || item.first_air_date || '';

    return {
        id: id,
        type: type,
        name: item.title || item.name,
        poster: item.poster_path ? IMG + 'w342' + item.poster_path : undefined,
        background: item.backdrop_path ? IMG + 'w1280' + item.backdrop_path : undefined,
        description: item.overview || undefined,
        releaseInfo: date ? date.slice(0, 4) : undefined,
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
        extra[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1));
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
function collected(key, type, id, age, need) {
    var list = lists.get(key);

    if (!list || Date.now() - list.time > LIST_TTL) {
        list = { time: Date.now(), metas: [], page: 0, total: 1 };
        lists.set(key, list);
    }

    var kind = type === 'movie' ? 'movie' : 'tv';

    function more() {
        if (list.metas.length >= need || list.page >= list.total) return Promise.resolve(list.metas);

        var d = discoverParams(id, age);
        d.params.page = list.page + 1;

        return tmdb(d.path, d.params).then(function (data) {
            list.page = d.params.page;
            list.total = Math.min(data.total_pages || 1, 500);

            return Promise.all((data.results || []).map(function (item) {
                return imdbId(kind, item.id).then(function (imdb) {
                    return imdb ? toMeta(item, type, imdb) : null;
                });
            }));
        }).then(function (metas) {
            metas.forEach(function (m) {
                if (m && !list.metas.some(function (x) { return x.id === m.id; })) list.metas.push(m);
            });
            return more();
        });
    }

    // запросы к одному списку выполняем по очереди
    list.busy = (list.busy || Promise.resolve()).then(more, more);
    return list.busy;
}

function catalog(type, id, extra) {
    var def = CATALOGS.filter(function (c) { return c.type === type && c.id === id; })[0];
    if (!def) return Promise.resolve(null);

    var age = ageByTitle(extra.genre) || ageByTitle(DEFAULT_AGE) || AGES[1];
    var skip = parseInt(extra.skip, 10) || 0;

    return collected(type + ':' + id + ':' + age.id, type, id, age, skip + PAGE_SIZE).then(function (metas) {
        return { metas: metas.slice(skip, skip + PAGE_SIZE), cacheMaxAge: 6 * 3600 };
    });
}

module.exports = {
    manifest: manifest,
    catalog: catalog,
    parseExtra: parseExtra,
    discoverParams: discoverParams,
    AGES: AGES
};

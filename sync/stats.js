'use strict';

// Turns a profile's synced Lampa data (favorite.js categories + file_view playback progress)
// into simple per-profile viewing stats: top genres, recently watched, total minutes.
//
// Lampa card fields have no media_type, so movie and TV genre ids are merged into one table;
// none of the ids collide in meaning between the two lists.
var GENRES = {
    28: 'Боевик', 12: 'Приключения', 16: 'Мультфильм', 35: 'Комедия', 80: 'Криминал',
    99: 'Документальный', 18: 'Драма', 10751: 'Семейный', 14: 'Фэнтези', 36: 'История',
    27: 'Ужасы', 10402: 'Музыка', 9648: 'Детектив', 10749: 'Мелодрама', 878: 'Фантастика',
    10770: 'Телефильм', 53: 'Триллер', 10752: 'Военный', 37: 'Вестерн',
    10759: 'Боевик и приключения', 10762: 'Детский', 10763: 'Новости', 10764: 'Реалити',
    10765: 'Фантастика и фэнтези', 10766: 'Мыльная опера', 10767: 'Ток-шоу', 10768: 'Военные и политика'
};

// the sync server stores every key as {v: <raw localStorage string>, t: <change time>}
function parseValue(stored) {
    if (!stored || typeof stored.v !== 'string') return null;
    try {
        return JSON.parse(stored.v);
    } catch (e) {
        return null;
    }
}

function dedupe(ids) {
    var seen = {};
    return ids.filter(function (id) {
        if (seen[id]) return false;
        seen[id] = true;
        return true;
    });
}

// profileData is the parsed p_<id>.json, e.g. {favorite: {v, t}, file_view: {v, t}, ...}
function computeStats(profileData) {
    var favorite = parseValue(profileData.favorite) || {};
    var cards = favorite.card || [];
    var cardById = {};
    cards.forEach(function (c) {
        if (c && c.id != null) cardById[c.id] = c;
    });

    // "viewed" (marked fully watched) is more meaningful than "history" (any open), when present
    var watchedIds = dedupe((favorite.viewed && favorite.viewed.length) ? favorite.viewed : (favorite.history || []));

    var genreCounts = {};
    watchedIds.forEach(function (id) {
        var card = cardById[id];
        if (!card || !card.genre_ids) return;
        card.genre_ids.forEach(function (gid) {
            var name = GENRES[gid];
            if (!name) return;
            genreCounts[name] = (genreCounts[name] || 0) + 1;
        });
    });

    var topGenres = Object.keys(genreCounts)
        .map(function (name) { return { name: name, count: genreCounts[name] }; })
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, 5);

    // ids are stored most-recent-first (Lampa unshifts on watch)
    var recentlyWatched = watchedIds.slice(0, 5).map(function (id) {
        var card = cardById[id];
        if (!card) return String(id);
        return card.title || card.name || card.original_title || card.original_name || String(id);
    });

    var fileView = parseValue(profileData.file_view) || {};
    var totalMinutesWatched = 0;
    Object.keys(fileView).forEach(function (hash) {
        var entry = fileView[hash];
        if (!entry || !entry.duration || !entry.percent || entry.percent < 5) return;
        totalMinutesWatched += (entry.duration * Math.min(entry.percent, 100) / 100) / 60;
    });

    return {
        totalTitlesWatched: watchedIds.length,
        topGenres: topGenres,
        recentlyWatched: recentlyWatched,
        totalMinutesWatched: Math.round(totalMinutesWatched)
    };
}

module.exports = { computeStats: computeStats, GENRES: GENRES };

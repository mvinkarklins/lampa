// Unit test for sync/stats.js: computes per-profile viewing stats from Lampa's synced
// "favorite" and "file_view" localStorage data, without needing a running server.
'use strict';

var assert = require('assert');
var stats = require('../sync/stats');

function storedJson(obj) {
    return { v: JSON.stringify(obj), t: Date.now() };
}

// empty profile: no data synced yet
(function () {
    var result = stats.computeStats({});
    assert.strictEqual(result.totalTitlesWatched, 0);
    assert.deepStrictEqual(result.topGenres, []);
    assert.deepStrictEqual(result.recentlyWatched, []);
    assert.strictEqual(result.totalMinutesWatched, 0);
})();

// genre counting, recency order and de-duplication
(function () {
    var favorite = {
        card: [
            { id: 1, title: 'Cartoon A', genre_ids: [16, 10751] },
            { id: 2, title: 'Cartoon B', genre_ids: [16, 35] },
            { id: 3, title: 'Movie C', genre_ids: [28] }
        ],
        // most-recent-first, id 2 duplicated as Lampa can re-add on rewatch
        viewed: [3, 2, 2, 1]
    };
    var result = stats.computeStats({ favorite: storedJson(favorite) });

    assert.strictEqual(result.totalTitlesWatched, 3);
    assert.deepStrictEqual(result.recentlyWatched, ['Movie C', 'Cartoon B', 'Cartoon A']);
    // Animation (16) appears on 2 cards, so it should be the top genre
    assert.strictEqual(result.topGenres[0].name, 'Мультфильм');
    assert.strictEqual(result.topGenres[0].count, 2);
})();

// falls back to "history" when nothing is marked fully "viewed"
(function () {
    var favorite = {
        card: [{ id: 5, name: 'Show D', genre_ids: [18] }],
        viewed: [],
        history: [5]
    };
    var result = stats.computeStats({ favorite: storedJson(favorite) });
    assert.strictEqual(result.totalTitlesWatched, 1);
    assert.strictEqual(result.topGenres[0].name, 'Драма');
})();

// total minutes watched from file_view, ignoring barely-started playback
(function () {
    var fileView = {
        hash1: { duration: 1200, time: 1200, percent: 100, updated: Date.now() },   // 20 min
        hash2: { duration: 600, time: 30, percent: 5, updated: Date.now() },        // 0.5 min
        hash3: { duration: 900, time: 9, percent: 1, updated: Date.now() }          // below threshold, ignored
    };
    var result = stats.computeStats({ file_view: storedJson(fileView) });
    assert.strictEqual(result.totalMinutesWatched, 21);
})();

// malformed / non-JSON stored values do not throw
(function () {
    var result = stats.computeStats({ favorite: { v: 'not json', t: 1 }, file_view: { v: '{}', t: 1 } });
    assert.strictEqual(result.totalTitlesWatched, 0);
})();

console.log('stats.test.js: all assertions passed');

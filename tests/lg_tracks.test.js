// Unit test for lg_tracks.js with a mocked webOS media service: it only works
// on a real LG TV, so the smoke test cannot exercise it in Chromium.
'use strict';

var assert = require('assert');
var vm = require('vm');
var fs = require('fs');
var path = require('path');

var calls = [];
var noty = [];
var select = null;
var panelTracks = null;
var button = null;

var webOS = {
    service: {
        request: function (uri, p) {
            calls.push(p.method);
            if (p.method === 'subscribe') {
                setTimeout(function () { p.onSuccess({ bufferRange: {} }); }, 5);
                setTimeout(function () {
                    p.onSuccess({ sourceInfo: { programInfo: [{ numAudioTracks: 3, audioTrackInfo: [
                        { language: 'rus', codec: 'AC3', channels: 6 },
                        { language: 'rus', codec: 'AAC', channels: 2 },
                        { language: 'eng', codec: 'DTS', channels: 6 }
                    ] }] } });
                }, 20);
            }
            if (p.method === 'selectTrack') setTimeout(function () { p.onSuccess({}); }, 5);
            return { cancel: function () { calls.push('cancel'); } };
        }
    }
};

var native = { nextSibling: null, parentNode: { insertBefore: function (b) { button = b; } } };

var Lampa = {
    Platform: { is: function (n) { return n === 'webos'; } },
    PlayerVideo: { video: function () { return { mediaId: '_test' }; } },
    PlayerPanel: { setTracks: function (t) { panelTracks = t; } },
    Player: { listener: { follow: function () {} } },
    Noty: { show: function (m) { noty.push(m); } },
    Select: { show: function (p) { select = p; } },
    Controller: { toggle: function () {} },
    Listener: { follow: function () {} }
};

var context = {
    window: { appready: true, webOS: webOS },
    webOS: webOS,
    Lampa: Lampa,
    document: {
        querySelector: function () { return native; },
        createElement: function () { return {}; }
    },
    $: function (el) { return { on: function (e, f) { el.enter = f; } }; },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Object: Object
};

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'lg_tracks.js'), 'utf8'), context);

assert.ok(button, 'button added to the player panel');
button.enter();

setTimeout(function () {
    assert.ok(select, 'track picker shown');
    assert.deepStrictEqual(select.items.map(function (i) { return i.title; }),
        ['1 · rus · 6 Ch · AC3', '2 · rus · 2 Ch · AAC', '3 · eng · 6 Ch · DTS']);
    assert.strictEqual(panelTracks.length, 3, 'tracks handed to the built-in button');
    assert.ok(calls.indexOf('cancel') >= 0, 'subscription cancelled after the answer');

    select.onSelect(select.items[2]);

    setTimeout(function () {
        assert.strictEqual(calls[calls.length - 1], 'selectTrack', 'track switched');
        assert.ok(noty.indexOf('Дорожка 3 включена') >= 0, 'user notified');
        console.log('PASS lg_tracks: picker, hand-off to Lampa, track switch');
    }, 20);
}, 60);

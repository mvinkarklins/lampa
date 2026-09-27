// «Дорожки LG» (LG tracks) button in the Lampa player panel on LG TVs (webOS).
// Lampa gets the audio track list from the TV media service, but looks for
// the video for only ~1 second after start. Torrents start slower, the list never
// arrives, and the built-in tracks button stays hidden. This button requests
// the list on press, while the video is already playing, without restarting playback.
(function () {
    'use strict';

    if (window.lg_tracks_plugin) return;
    window.lg_tracks_plugin = true;

    var VERSION = '1.0.0';
    var WAIT = 20000;

    var ICON = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

    var button = null;
    var request = null;

    function luna(method, parameters, success, failure) {
        return webOS.service.request('luna://com.webos.media', {
            method: method,
            parameters: parameters,
            onSuccess: success || function () {},
            onFailure: failure || function () {}
        });
    }

    function video() {
        try { return Lampa.PlayerVideo.video(); } catch (e) { return null; }
    }

    function stop() {
        if (request && request.cancel) {
            try { request.cancel(); } catch (e) {}
        }
        request = null;
    }

    function backToPanel() {
        Lampa.Controller.toggle('player_panel');
    }

    function trackName(t, i) {
        var name = [i + 1];
        var lang = t.language && t.language !== '(null)' ? t.language : '';
        name.push(lang || 'Дорожка');
        if (t.label) name.push(t.label);
        if (t.channels) name.push(t.channels + ' Ch');
        if (t.codec) name.push(t.codec);
        return name.join(' · ');
    }

    // tracks in the shape Lampa's built-in button expects (as in its webos/parser.js)
    function lampaTracks(list, mediaId) {
        return list.map(function (t, i) {
            var track = {
                index: i,
                language: t.language && t.language !== '(null)' ? t.language : '',
                label: t.label || '',
                selected: false,
                extra: { channels: t.channels, fourCC: t.codec }
            };
            Object.defineProperty(track, 'enabled', {
                set: function (v) { if (v) selectTrack(mediaId, i); },
                get: function () { return false; }
            });
            return track;
        });
    }

    function selectTrack(mediaId, index) {
        luna('selectTrack', { type: 'audio', mediaId: mediaId, index: index }, function () {
            Lampa.Noty.show('Дорожка ' + (index + 1) + ' включена');
        }, function (r) {
            Lampa.Noty.show('Телевизор не переключил дорожку' + (r && r.errorText ? ': ' + r.errorText : ''));
        });
    }

    function showList(list, mediaId) {
        Lampa.Select.show({
            title: 'Звуковые дорожки',
            items: list.map(function (t, i) { return { title: trackName(t, i), index: i }; }),
            onSelect: function (item) {
                selectTrack(mediaId, item.index);
                backToPanel();
            },
            onBack: backToPanel
        });
    }

    // fallback: standard video.audioTracks, if the TV supports it
    function html5Tracks(v) {
        var at = v && v.audioTracks;
        if (!at || !at.length) return null;

        var list = [];
        for (var i = 0; i < at.length; i++) list.push(at[i]);
        return list;
    }

    function showHtml5(list) {
        Lampa.Select.show({
            title: 'Звуковые дорожки',
            items: list.map(function (t, i) {
                return { title: (i + 1) + ' · ' + (t.language || t.label || 'Дорожка'), index: i, selected: t.enabled };
            }),
            onSelect: function (item) {
                list.forEach(function (t, i) { t.enabled = i === item.index; });
                Lampa.Noty.show('Дорожка ' + (item.index + 1) + ' включена');
                backToPanel();
            },
            onBack: backToPanel
        });
    }

    function query() {
        var v = video();
        var mediaId = v && v.mediaId;

        if (!mediaId) {
            var fallback = html5Tracks(v);
            if (fallback) return showHtml5(fallback);
            return Lampa.Noty.show('Телевизор ещё не отдал видео. Подождите, пока фильм начнёт играть, и нажмите снова');
        }

        stop();
        Lampa.Noty.show('Спрашиваю у телевизора список дорожек…');

        var done = false;
        var timer = setTimeout(function () {
            if (done) return;
            done = true;
            stop();
            var fallback = html5Tracks(v);
            if (fallback) showHtml5(fallback);
            else Lampa.Noty.show('Телевизор не прислал список дорожек за ' + (WAIT / 1000) + ' с');
        }, WAIT);

        request = luna('subscribe', { mediaId: mediaId, subscribe: true }, function (result) {
            if (done || !result || !result.sourceInfo) return;

            var info = result.sourceInfo.programInfo && result.sourceInfo.programInfo[0];
            var list = (info && info.audioTrackInfo) || [];

            done = true;
            clearTimeout(timer);
            stop();

            if (!list.length) return Lampa.Noty.show('Телевизор не нашёл звуковых дорожек в файле');

            // hand the list to Lampa so its built-in tracks button appears too
            try { Lampa.PlayerPanel.setTracks(lampaTracks(list, mediaId)); } catch (e) {}

            if (list.length === 1) Lampa.Noty.show('В файле одна звуковая дорожка: ' + trackName(list[0], 0));
            else showList(list, mediaId);
        }, function (r) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            Lampa.Noty.show('Ошибка медиасервиса телевизора' + (r && r.errorText ? ': ' + r.errorText : ''));
        });
    }

    function addButton() {
        if (button) return;

        var native = document.querySelector('.player-panel__tracks');
        if (!native || !native.parentNode) return;

        button = document.createElement('div');
        button.className = 'player-panel__lg-tracks button selector';
        button.innerHTML = ICON + '<div class="tooltip">Дорожки LG</div>';
        native.parentNode.insertBefore(button, native.nextSibling);

        $(button).on('hover:enter', query);
    }

    function init() {
        if (!Lampa.Platform.is('webos') || !window.webOS || !webOS.service) return;

        addButton();

        Lampa.Player.listener.follow('start', addButton);
        Lampa.Player.listener.follow('destroy', stop);
    }

    if (window.appready) init();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }

    window.lg_tracks_plugin_api = { version: VERSION, query: query };
})();

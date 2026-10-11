// TorBox: a «Торренты через TorBox» button on the movie card, next to «Смотреть». Searches
// with your own parser (same Lampa.Parser.get used by torrent_button.js), then streams the
// pick through TorBox (api.torbox.app) -- no local download, no Deluge/TorrServer involved.
//
// TorBox's API needs a custom Authorization header, which browsers won't send cross-origin
// without TorBox opting in via CORS (it doesn't). So API calls go through your own lampa-sync
// server (same one the Profiles plugin uses, Settings -> Профили -> Сервер), which proxies
// /api/torbox/* straight to TorBox -- see sync/server.js. Your API key is stored only in
// Lampa's local storage and sent straight to TorBox through that proxy; the proxy never reads
// or logs it. The actual video stream is NOT proxied: TorBox hands back a direct CDN link and
// the player talks to that directly, so your tiny sync server never carries video bytes.
(function () {
    'use strict';

    if (window.torbox_plugin) return;
    window.torbox_plugin = true;

    var VERSION = '1.0.1';
    var KEY_STORAGE = 'torbox_key';
    var POLL_INTERVAL = 4000;
    var POLL_MAX_TRIES = 45; // ~3 minutes of polling before giving up
    var VIDEO_EXT = /\.(mkv|mp4|avi|ts|m4v|webm)$/i;

    // cloud + play arrow, distinct from the native torrent (magnet) icon -- this streams from
    // TorBox's cache, it doesn't download a torrent locally
    var ICON = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M7 18a4.5 4.5 0 0 1-.5-8.98A5.5 5.5 0 0 1 17 8.5a4 4 0 0 1-.6 7.98" ' +
        'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M11.5 12.5 14.5 14.5 11.5 16.5z" fill="currentColor"/></svg>';

    function syncBase() {
        var u = Lampa.Storage.get('nsync_url', '') || '';
        return u.replace(/\/+$/, '');
    }

    function apiKey() {
        return Lampa.Storage.get(KEY_STORAGE, '') || '';
    }

    function askKey(callback) {
        Lampa.Input.edit({
            title: 'TorBox API key',
            value: apiKey(),
            free: true,
            nosave: true,
            password: true
        }, function (value) {
            value = (value || '').trim();
            Lampa.Storage.set(KEY_STORAGE, value);
            if (callback) callback(value);
        });
    }

    // GET/POST a JSON TorBox call through the lampa-sync proxy. `qs` is a pre-built query
    // string (without the leading '?'); `method`/`body` default to a plain GET.
    function torboxJson(path, qs, opts, done, fail) {
        opts = opts || {};
        var base = syncBase();
        if (!base) return fail('не настроен сервер синхронизации (Настройки -> Профили)');
        var key = apiKey();
        if (!key) return fail('не задан API-ключ TorBox');

        var xhr = new XMLHttpRequest();
        xhr.open(opts.method || 'GET', base + '/api/torbox/' + path + (qs ? '?' + qs : ''), true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + key);
        if (opts.json) xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 30000;
        xhr.onload = function () {
            var json = null;
            try { json = JSON.parse(xhr.responseText); } catch (e) {}
            if (xhr.status >= 200 && xhr.status < 300 && json) done(json);
            else fail((json && (json.detail || json.error)) || ('HTTP ' + xhr.status));
        };
        xhr.onerror = function () { fail('ошибка сети'); };
        xhr.ontimeout = function () { fail('не отвечает'); };
        xhr.send(opts.json ? JSON.stringify(opts.json) : (opts.form || null));
    }

    // `link` is whatever the search result gave us -- a real magnet: URI, or (most trackers)
    // an http(s) link to a .torrent file. The sync server tells them apart: a real magnet goes
    // straight to TorBox, anything else gets fetched server-side and uploaded as a file --
    // the browser can't fetch most tracker links itself (no CORS, often needs the same auth
    // as the search).
    function createTorrent(link, done, fail) {
        torboxJson('addtorrent', '', { method: 'POST', json: { url: link } }, done, fail);
    }

    function pollUntilReady(torrentId, movie, tries) {
        tries = tries || 0;
        torboxJson('torrents/mylist', 'id=' + torrentId + '&bypass_cache=true', {}, function (resp) {
            var t = resp && resp.data;
            if (t && (t.download_finished || (t.download_present && t.files && t.files.length))) {
                return pickFile(t, movie);
            }
            retry();
        }, function () { retry(); });

        function retry() {
            tries++;
            if (tries === 1) Lampa.Noty.show('TorBox: качаю/кэширую, подождите...');
            if (tries >= POLL_MAX_TRIES) {
                return Lampa.Noty.show('TorBox: не дождался готовности. Посмотри статус в приложении TorBox и попробуй открыть позже.');
            }
            setTimeout(function () { pollUntilReady(torrentId, movie, tries); }, POLL_INTERVAL);
        }
    }

    function pickFile(t, movie) {
        var all = t.files || [];
        var files = all.filter(function (f) { return VIDEO_EXT.test(f.short_name || f.name || ''); });
        if (!files.length) files = all;
        if (!files.length) return Lampa.Noty.show('TorBox: в торренте нет файлов');

        files.sort(function (a, b) { return (b.size || 0) - (a.size || 0); });

        if (files.length === 1) return play(t, files[0], movie);

        Lampa.Select.show({
            title: 'Выбери файл',
            items: files.map(function (f) {
                return { title: f.short_name || f.name || ('Файл ' + f.id), file: f };
            }),
            onSelect: function (item) { play(t, item.file, movie); },
            onBack: function () { Lampa.Controller.toggle('content'); }
        });
    }

    function play(t, file, movie) {
        var qs = 'token=' + encodeURIComponent(apiKey()) + '&torrent_id=' + t.id + '&file_id=' + file.id;
        torboxJson('torrents/requestdl', qs, {}, function (resp) {
            var url = resp && resp.data;
            if (!url) return Lampa.Noty.show('TorBox: не удалось получить ссылку на файл');

            Lampa.Player.play({
                url: url,
                title: (movie && (movie.title || movie.name)) || file.short_name || file.name,
                card: movie
            });
            Lampa.Player.playlist([{
                url: url,
                title: (movie && (movie.title || movie.name)) || file.short_name || file.name
            }]);
        }, function (err) { Lampa.Noty.show('TorBox: ' + err); });
    }

    function streamViaTorbox(result, movie) {
        var magnet = result.MagnetUri || result.magnetUrl || result.downloadUrl || result.Link;
        if (!magnet) return Lampa.Noty.show('У этого результата нет magnet-ссылки');

        if (!apiKey()) return askKey(function (key) {
            if (key) streamViaTorbox(result, movie);
        });

        Lampa.Noty.show('TorBox: добавляю...');
        createTorrent(magnet, function (resp) {
            var torrentId = resp && resp.data && resp.data.torrent_id;
            if (!torrentId) return Lampa.Noty.show('TorBox: ' + ((resp && resp.detail) || 'не удалось добавить'));
            pollUntilReady(torrentId, movie);
        }, function (err) { Lampa.Noty.show('TorBox: ' + err); });
    }

    function showResults(movie, data) {
        var results = (data && data.Results) || [];
        if (!results.length) return Lampa.Noty.show('TorBox: ничего не нашлось');

        results.sort(function (a, b) { return (b.Seeders || 0) - (a.Seeders || 0); });

        Lampa.Select.show({
            title: 'TorBox: выбери релиз',
            items: results.slice(0, 50).map(function (r) {
                return {
                    title: r.Title,
                    subtitle: (r.size || '') + ' · ' + (r.Seeders || 0) + ' seeders · ' + (r.Tracker || ''),
                    result: r
                };
            }),
            onSelect: function (item) { streamViaTorbox(item.result, movie); },
            onBack: function () { Lampa.Controller.toggle('full_start'); }
        });
    }

    function search(movie) {
        var query = movie.title || movie.name || '';
        Lampa.Noty.show('Ищу: ' + query);

        Lampa.Parser.get({ search: query, movie: movie, global: true }, function (data) {
            showResults(movie, data);
        }, function (err) {
            Lampa.Noty.show('Поиск не удался: ' + (err || ''));
        });
    }

    function addSetting() {
        if (!Lampa.SettingsApi) return;

        Lampa.SettingsApi.addParam({
            component: 'parser',
            param: { name: 'torbox_edit_key', type: 'trigger', "default": false },
            field: {
                name: 'TorBox: API-ключ',
                description: apiKey() ? 'Ключ сохранён. Выбери, чтобы заменить.' : 'Не задан. Выбери, чтобы вставить.'
            },
            onChange: function () { askKey(); }
        });
    }

    addSetting();

    Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'complite') return;

        var body = e.body;
        var movie = e.data && e.data.movie;
        if (!movie) return;

        var source = body.find('.buttons--container .view--torrent');
        var row = body.find('.full-start-new__buttons');

        if (!source.length || !row.length) return;
        if (row.find('.button--torbox').length) return;

        var button = source.clone()
            .removeClass('view--torrent hide')
            .addClass('selector button--torbox');

        button.find('svg').replaceWith(ICON);
        button.find('span').text('TorBox');

        button.on('hover:enter', function () { search(movie); });

        var play = row.find('.button--play');
        if (play.length) play.after(button);
        else row.prepend(button);

        var controller = Lampa.Controller.enabled();
        if (controller && controller.name === 'full_start') Lampa.Controller.toggle('full_start');
    });

    window.torbox_plugin_api = { version: VERSION };
})();

// «Торренты» (Torrents) button right on the movie card, next to «Смотреть» (Watch).
// Lampa can pin it natively with a long press in the source picker,
// but long press does not work on LG remotes.
//
// On press you choose where to search: your own parser from Lampa's settings (any
// Jackett-compatible one, e.g. Prowlarr), a public JacRed if yours is down, or both
// at once. The default is also set in
// Settings → Parser → «Кнопка «Торренты» на карточке».
(function () {
    'use strict';

    if (window.torrent_button_plugin) return;
    window.torrent_button_plugin = true;

    var SETTING = 'tbutton_source';
    var LAST = 'tbutton_last';

    // public JacRed instances, checked on 2026-09-26
    var PUBLIC = ['jac.red', 'jac-red.ru', 'jr.maxvol.pro'];

    var BOTH = 'both';
    var SOURCES = { ask: 'Спрашивать каждый раз', own: 'Мой парсер из настроек' };
    SOURCES[BOTH] = 'Везде: мой парсер + ' + PUBLIC[0];
    PUBLIC.forEach(function (host) { SOURCES[host] = host; });

    // Search via a public parser: we override Storage.field answers only while the
    // search starts synchronously (Lampa reads parser settings at that moment).
    // Nothing is written to localStorage, so temporary values do not spread
    // to other devices through profile sync.
    var pending = null;
    var active = null;

    function publicSettings(host) {
        return {
            parser_torrent_type: 'jackett',
            parser_use_link: 'one',
            jackett_url: 'https://' + host,
            jackett_key: '',
            jackett_interview: 'all'
        };
    }

    // the same release from different parsers: same title and size
    function resultKey(item) {
        return String(item.Title || '').toLowerCase().replace(/\s+/g, ' ').trim() + '|' + (item.Size || '');
    }

    function patch() {
        var field = Lampa.Storage.field;
        var get = Lampa.Parser.get;

        Lampa.Storage.field = function (name) {
            if (active && Object.prototype.hasOwnProperty.call(active, name)) return active[name];
            return field.apply(this, arguments);
        };

        function run(self, settings, params, ok, fail) {
            active = settings;
            try {
                get.call(self, params, ok, fail);
            } finally {
                active = null;
            }
        }

        Lampa.Parser.get = function (params, oncomplite, onerror) {
            // the override only applies to a search started by our button in the last few seconds
            var job = pending && Date.now() - pending.time < 10000 ? pending : null;
            pending = null;

            if (!job) return get.apply(this, arguments);
            if (!job.both) return run(this, job.settings, params, oncomplite, onerror);

            // both parsers in parallel: own results first, then public ones without duplicates
            var results = [null, null];
            var errors = [];
            var left = 2;

            var collect = function (index) {
                return function (data) {
                    results[index] = (data && data.Results) || [];
                    if (--left === 0) finish();
                };
            };
            var failed = function (err) {
                errors.push(err);
                if (--left === 0) finish();
            };
            var finish = function () {
                if (!results[0] && !results[1]) return onerror(errors[0] || '');

                var seen = {};
                var merged = [];

                (results[0] || []).concat(results[1] || []).forEach(function (item) {
                    var key = resultKey(item);
                    if (seen[key]) return;
                    seen[key] = true;
                    merged.push(item);
                });

                oncomplite({ Results: merged });
            };

            run(this, null, params, collect(0), failed);
            run(this, job.settings, params, collect(1), failed);
        };
    }

    function search(source, choice) {
        try { localStorage.setItem(LAST, choice); } catch (e) {}

        if (choice === 'own') pending = null;
        else if (choice === BOTH) pending = { both: true, settings: publicSettings(PUBLIC[0]), time: Date.now() };
        else pending = { settings: publicSettings(choice), time: Date.now() };

        source.trigger('hover:enter');
    }

    function choose(source) {
        var last = 'own';
        try { last = localStorage.getItem(LAST) || 'own'; } catch (e) {}

        var items = [
            { title: 'Мой парсер', subtitle: 'из настроек Lampa', choice: 'own', selected: last === 'own' },
            { title: 'Везде', subtitle: 'мой парсер + ' + PUBLIC[0] + ', без повторов', choice: BOTH, selected: last === BOTH }
        ];
        PUBLIC.forEach(function (host) {
            items.push({ title: host, subtitle: 'публичный JacRed', choice: host, selected: last === host });
        });

        Lampa.Select.show({
            title: 'Где искать торренты',
            items: items,
            onSelect: function (item) {
                search(source, item.choice);
            },
            onBack: function () {
                Lampa.Controller.toggle('full_start');
            }
        });
    }

    function addSetting() {
        if (!Lampa.SettingsApi) return;

        Lampa.SettingsApi.addParam({
            component: 'parser',
            param: { name: SETTING, type: 'select', values: SOURCES, default: BOTH },
            field: {
                name: 'Кнопка «Торренты» на карточке',
                description: 'Где искать по кнопке: спрашивать, свой парсер, публичный JacRed или везде сразу'
            }
        });
    }

    patch();
    addSetting();

    Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'complite') return;

        var body = e.body;
        var source = body.find('.buttons--container .view--torrent');
        var row = body.find('.full-start-new__buttons');

        // Parser is off or torrents are hidden by this build — no button.
        if (!source.length || source.hasClass('hide') || !row.length) return;
        if (row.find('.button--torrent-direct').length) return;

        var button = source.clone()
            .removeClass('view--torrent hide')
            .addClass('selector button--torrent-direct');

        button.on('hover:enter', function () {
            var mode = Lampa.Storage.get(SETTING, BOTH) + '';

            if (mode === 'ask') choose(source);
            else search(source, SOURCES[mode] ? mode : 'own');
        });

        var play = row.find('.button--play');

        if (play.length) play.after(button);
        else row.prepend(button);

        var controller = Lampa.Controller.enabled();

        if (controller && controller.name === 'full_start') Lampa.Controller.toggle('full_start');
    });
})();

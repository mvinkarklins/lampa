// Профили Лампы с синхронизацией через свой сервер на NAS (папка sync/).
// У каждого профиля свои закладки, история и таймкоды; настройки TorrServer
// и парсера общие для всех профилей и устройств.
(function () {
    'use strict';

    if (window.nas_profiles_plugin) return;
    window.nas_profiles_plugin = true;

    var VERSION = '1.2.1';
    var DEFAULT_URL = 'http://192.168.1.25';
    var SYNC_EVERY = 5 * 60 * 1000;
    var PUSH_DELAY = 5000;

    // данные профиля: точные ключи и префиксы (file_view_<id> у аккаунта CUB)
    var PROFILE_KEYS = ['favorite', 'online_view', 'torrents_view', 'search_history',
        'online_last_balanser', 'user_clarifys', 'torrents_filter_data', 'kids_age_last'];
    var PROFILE_PREFIXES = ['file_view'];

    // общие настройки для всех профилей
    var SHARED_KEYS = ['torrserver_url', 'torrserver_url_two', 'torrserver_use_link',
        'torrserver_auth', 'torrserver_login', 'torrserver_password',
        'parser_use', 'parser_torrent_type', 'parser_use_link', 'parse_lang',
        'prowlarr_url', 'prowlarr_key', 'prowlarr_url_two', 'prowlarr_key_two',
        'jackett_url', 'jackett_key', 'jackett_url_two', 'jackett_key_two',
        // список установленных плагинов; после его смены Лампу нужно перезапустить
        'plugins'];

    // служебные ключи плагина пишем в localStorage напрямую, мимо Lampa.Storage
    var META_URL = 'nsync_url';
    var META_PROFILE = 'nsync_profile';
    var META_STATE = 'nsync_state';

    var profiles = [];
    var pushTimer = null;
    var busy = false;
    var menuItem = null;

    function ls(key, value) {
        try {
            if (value === undefined) return localStorage.getItem(key);
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
        } catch (e) {}
        return null;
    }

    function serverUrl() {
        return (ls(META_URL) || DEFAULT_URL).replace(/\/$/, '');
    }

    function currentId() {
        return ls(META_PROFILE) || '';
    }

    function currentProfile() {
        for (var i = 0; i < profiles.length; i++) {
            if (profiles[i].id === currentId()) return profiles[i];
        }
        return null;
    }

    // состояние синхронизации: {scope: {key: {t: время, h: хэш значения}}}
    function loadState() {
        try {
            return JSON.parse(ls(META_STATE) || '{}');
        } catch (e) {
            return {};
        }
    }

    function saveState(state) {
        ls(META_STATE, JSON.stringify(state));
    }

    function hash(str) {
        var h = 5381;
        for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
        return str.length + ':' + h;
    }

    // список плагинов с сервера плюс те, что есть только на этом устройстве
    function mergePlugins(localRaw, remoteRaw) {
        try {
            var remote = JSON.parse(remoteRaw);
            var urls = remote.map(function (p) { return typeof p === 'string' ? p : p.url; });

            JSON.parse(localRaw).forEach(function (p) {
                var url = typeof p === 'string' ? p : p.url;
                if (urls.indexOf(url) < 0) {
                    remote.push(p);
                    urls.push(url);
                }
            });

            return JSON.stringify(remote);
        } catch (e) {
            return remoteRaw;
        }
    }

    function isProfileKey(key) {
        if (PROFILE_KEYS.indexOf(key) >= 0) return true;
        for (var i = 0; i < PROFILE_PREFIXES.length; i++) {
            if (key.indexOf(PROFILE_PREFIXES[i]) === 0) return true;
        }
        return false;
    }

    function isSharedKey(key) {
        return SHARED_KEYS.indexOf(key) >= 0;
    }

    function localKeys(scope) {
        var keys = [];
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (scope === 'shared' ? isSharedKey(key) : isProfileKey(key)) keys.push(key);
            }
        } catch (e) {}
        return keys;
    }

    function request(method, path, body, done) {
        var xhr = new XMLHttpRequest();
        xhr.open(method, serverUrl() + path, true);
        xhr.timeout = 15000;
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                var data = {};
                try { data = JSON.parse(xhr.responseText || '{}'); } catch (e) {}
                done(null, data);
            } else done(new Error('HTTP ' + xhr.status));
        };
        xhr.onerror = xhr.ontimeout = function () {
            done(new Error('нет связи с ' + serverUrl()));
        };
        xhr.send(body === undefined ? null : JSON.stringify(body));
    }

    // записать значение с сервера так, чтобы Лампа сразу его увидела
    function apply(key, raw) {
        var value = raw;
        try { value = JSON.parse(raw); } catch (e) {}
        Lampa.Storage.set(key, value, true);
    }

    // синхронизация одной области: shared или id профиля.
    // force — взять всё с сервера (при смене профиля)
    function syncScope(scope, force, done) {
        request('GET', '/api/store/' + scope, undefined, function (err, remote) {
            if (err) return done(err);

            var state = loadState();
            var st = state[scope] || (state[scope] = {});
            var push = {};
            var pulled = [];
            var now = Date.now();

            // локальные изменения, которых сервер ещё не видел
            localKeys(scope).forEach(function (key) {
                var raw = ls(key);
                if (raw === null) return;
                var h = hash(raw);
                var known = st[key];

                if (!known || known.h !== h) st[key] = known = { t: known ? now : 0, h: h };
                if (known.t === 0 && !remote[key]) known.t = now;

                if (!force && known.t > 0 && (!remote[key] || known.t > remote[key].t)) {
                    push[key] = { v: raw, t: known.t };
                }
            });

            // более свежие значения с сервера
            Object.keys(remote).forEach(function (key) {
                if (scope === 'shared' ? !isSharedKey(key) : !isProfileKey(key)) return;
                var r = remote[key];
                var known = st[key];

                // первая синхронизация плагинов на устройстве: объединяем списки, чтобы не потерять свои
                if (key === 'plugins' && !force && (!known || known.t === 0) && ls(key)) {
                    var merged = mergePlugins(ls(key), r.v);
                    if (merged !== r.v) {
                        apply(key, merged);
                        pulled.push(key);
                        st[key] = { t: now, h: hash(ls(key) || merged) };
                        push[key] = { v: ls(key) || merged, t: now };
                        return;
                    }
                }

                if (force || !known || r.t > known.t) {
                    if (ls(key) !== r.v) {
                        apply(key, r.v);
                        pulled.push(key);
                    }
                    // Лампа может пересобрать JSON иначе, хэш берём от того, что записалось
                    st[key] = { t: r.t, h: hash(ls(key) || r.v) };
                }
            });

            saveState(state);

            if (!Object.keys(push).length) return done(null, pulled);

            request('POST', '/api/store/' + scope, push, function (err2) {
                done(err2, pulled);
            });
        });
    }

    function syncAll(done) {
        done = done || function () {};
        if (busy || !currentId()) return done(new Error('busy'));
        busy = true;

        syncScope('shared', false, function (err, pulledShared) {
            if (err) {
                busy = false;
                return done(err);
            }
            syncScope(currentId(), false, function (err2, pulled) {
                busy = false;
                if (pulled && pulled.indexOf('favorite') >= 0 && Lampa.Favorite) Lampa.Favorite.read();
                if (pulledShared && pulledShared.indexOf('plugins') >= 0) {
                    Lampa.Noty.show('Список плагинов обновлён, перезапускаю Лампу…');
                    setTimeout(function () { window.location.reload(); }, 1500);
                }
                done(err2, (pulledShared || []).concat(pulled || []));
            });
        });
    }

    function schedulePush() {
        clearTimeout(pushTimer);
        pushTimer = setTimeout(function () { syncAll(); }, PUSH_DELAY);
    }

    function loadProfiles(done) {
        request('GET', '/api/profiles', undefined, function (err, data) {
            if (!err) profiles = data.profiles || [];
            done(err);
        });
    }

    function saveProfiles(done) {
        request('PUT', '/api/profiles', { profiles: profiles }, function (err, data) {
            if (!err) profiles = data.profiles || profiles;
            done(err);
        });
    }

    function removeProfileData() {
        localKeys('profile').forEach(function (key) { ls(key, null); });
        var state = loadState();
        delete state[currentId()];
        saveState(state);
    }

    // сменить профиль: отправить текущие данные, очистить, скачать данные нового и перезапустить
    function switchTo(id) {
        if (id === currentId()) return;

        Lampa.Noty.show('Переключаю профиль…');

        var go = function () {
            removeProfileData();
            ls(META_PROFILE, id);
            syncScope(id, true, function (err) {
                if (err) Lampa.Noty.show('Профиль выбран, но данные не загрузились: ' + err.message);
                setTimeout(function () { window.location.reload(); }, 300);
            });
        };

        // устройство впервые выбирает профиль: объединяем его данные с профилем, а не стираем
        if (!currentId()) {
            ls(META_PROFILE, id);
            return syncAll(function (err) {
                if (err) Lampa.Noty.show('Профиль выбран, но синхронизация не прошла: ' + err.message);
                setTimeout(function () { window.location.reload(); }, 300);
            });
        }

        syncAll(function (err) {
            if (err && err.message !== 'busy') {
                return Lampa.Noty.show('Не удалось сохранить текущий профиль, смена отменена: ' + err.message);
            }
            go();
        });
    }

    function addProfile() {
        Lampa.Input.edit({ title: 'Имя профиля', value: '', free: true, nosave: true }, function (name) {
            name = (name || '').trim();
            if (!name) return showMenu();

            var id = 'p' + Date.now().toString(36);
            profiles.push({ id: id, name: name });

            saveProfiles(function (err) {
                if (err) return Lampa.Noty.show('Не удалось добавить профиль: ' + err.message);
                switchTo(id);
            });
        });
    }

    function deleteProfile() {
        var items = profiles.filter(function (p) { return p.id !== currentId(); }).map(function (p) {
            return { title: p.name, profile: p };
        });

        if (!items.length) return Lampa.Noty.show('Нельзя удалить текущий профиль');

        Lampa.Select.show({
            title: 'Удалить профиль (вместе с его закладками и историей)',
            items: items,
            onSelect: function (item) {
                profiles = profiles.filter(function (p) { return p.id !== item.profile.id; });
                saveProfiles(function (err) {
                    if (err) return Lampa.Noty.show('Ошибка: ' + err.message);
                    request('DELETE', '/api/store/' + item.profile.id, undefined, function () {});
                    Lampa.Noty.show('Профиль «' + item.profile.name + '» удалён');
                    showMenu();
                });
            },
            onBack: showMenu
        });
    }

    function editServer() {
        Lampa.Input.edit({ title: 'Адрес сервера синхронизации', value: serverUrl(), free: true, nosave: true }, function (url) {
            url = (url || '').trim();
            if (url) ls(META_URL, url);
            start();
        });
    }

    function showMenu() {
        var items = profiles.map(function (p) {
            return { title: p.name, selected: p.id === currentId(), profile: p };
        });

        items.push({ title: '+ Добавить профиль', action: addProfile });
        if (profiles.length > 1) items.push({ title: 'Удалить профиль', action: deleteProfile });
        items.push({ title: 'Синхронизировать сейчас', action: syncNow });

        if (currentId()) {
            items.push({
                title: 'Загрузить с сервера',
                subtitle: 'заменить данные на этом устройстве',
                action: function () {
                    confirm('Заменить данные на этом устройстве серверными?', forcePull);
                }
            });
            items.push({
                title: 'Отправить на сервер',
                subtitle: 'заменить данные на сервере',
                action: function () {
                    confirm('Заменить данные профиля на сервере данными этого устройства?', forcePush);
                }
            });
        }
        items.push({ title: 'Сервер', subtitle: serverUrl(), action: editServer });

        Lampa.Select.show({
            title: 'Профиль · v' + VERSION,
            items: items,
            onSelect: function (item) {
                if (item.action) item.action();
                else switchTo(item.profile.id);
            },
            onBack: function () {
                Lampa.Controller.toggle(currentId() ? 'menu' : 'content');
            }
        });
    }

    function syncNow() {
        syncAll(function (err, pulled) {
            if (err) Lampa.Noty.show('Ошибка синхронизации: ' + err.message);
            else Lampa.Noty.show('Синхронизировано' + (pulled.length ? ', обновлено: ' + pulled.length : ''));
        });
    }

    function confirm(title, action) {
        Lampa.Select.show({
            title: title,
            items: [{ title: 'Да', yes: true }, { title: 'Нет' }],
            onSelect: function (item) {
                if (item.yes) action();
                else showMenu();
            },
            onBack: showMenu
        });
    }

    // данные профиля и общие настройки на устройстве заменяются серверными
    function forcePull() {
        if (busy) return Lampa.Noty.show('Идёт синхронизация, попробуйте через пару секунд');
        busy = true;
        Lampa.Noty.show('Загружаю с сервера…');

        syncScope('shared', true, function (err) {
            if (err) {
                busy = false;
                return Lampa.Noty.show('Ошибка: ' + err.message);
            }
            removeProfileData();
            syncScope(currentId(), true, function (err2) {
                busy = false;
                if (err2) return Lampa.Noty.show('Ошибка: ' + err2.message);
                setTimeout(function () { window.location.reload(); }, 300);
            });
        });
    }

    function snapshot(scope) {
        var data = {};
        var state = loadState();
        var st = state[scope] = {};
        var now = Date.now();

        localKeys(scope).forEach(function (key) {
            var raw = ls(key);
            if (raw === null) return;
            data[key] = { v: raw, t: now };
            st[key] = { t: now, h: hash(raw) };
        });

        saveState(state);
        return data;
    }

    // данные устройства заменяют серверные: профиль на сервере очищается и пишется заново
    function forcePush() {
        if (busy) return Lampa.Noty.show('Идёт синхронизация, попробуйте через пару секунд');
        busy = true;
        Lampa.Noty.show('Отправляю на сервер…');

        var done = function (err) {
            busy = false;
            Lampa.Noty.show(err ? 'Ошибка: ' + err.message : 'Данные устройства отправлены на сервер');
        };

        request('POST', '/api/store/shared', snapshot('shared'), function (err) {
            if (err) return done(err);
            request('DELETE', '/api/store/' + currentId(), undefined, function (err2) {
                if (err2) return done(err2);
                request('POST', '/api/store/' + currentId(), snapshot(currentId()), done);
            });
        });
    }

    var ICON = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/>' +
        '<path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
        '</svg>';

    function updateMenu() {
        if (!menuItem) {
            menuItem = $('<li class="menu__item selector" data-action="nas_profiles">' +
                '<div class="menu__ico">' + ICON + '</div>' +
                '<div class="menu__text"></div>' +
                '</li>');
            menuItem.on('hover:enter', function () {
                loadProfiles(function () { showMenu(); });
            });
            $('.menu .menu__list').eq(0).prepend(menuItem);
        }

        var p = currentProfile();
        menuItem.find('.menu__text').text(p ? p.name : 'Профиль');
    }

    function start() {
        updateMenu();

        loadProfiles(function (err) {
            if (err) return Lampa.Noty.show('Профили: ' + err.message);

            // первый запуск: создаём профиль из того, что уже есть на устройстве
            if (!profiles.length) {
                profiles = [{ id: 'main', name: 'Основной' }];
                return saveProfiles(function (err2) {
                    if (err2) return Lampa.Noty.show('Профили: ' + err2.message);
                    ls(META_PROFILE, 'main');
                    updateMenu();
                    syncAll();
                });
            }

            // устройство ещё не выбрало профиль или его профиль удалили
            if (!currentProfile()) {
                ls(META_PROFILE, null);
                updateMenu();
                return showMenu();
            }

            updateMenu();
            syncAll(function (err3, pulled) {
                if (!err3 && pulled && pulled.length) Lampa.Noty.show('Профиль «' + currentProfile().name + '» синхронизирован');
            });
        });
    }

    var started = false;

    function init() {
        if (started) return;
        started = true;

        Lampa.Storage.listener.follow('change', function (e) {
            if (currentId() && (isProfileKey(e.name) || isSharedKey(e.name))) schedulePush();
        });

        setInterval(function () { syncAll(); }, SYNC_EVERY);

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) syncAll();
        });

        start();
    }

    if (window.appready) init();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }

    window.nas_profiles_plugin_api = { version: VERSION, sync: syncAll, profiles: function () { return profiles; } };
})();

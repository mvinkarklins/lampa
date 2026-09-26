// «Neo» — новый интерфейс Лампы в духе Netflix.
//  - тёмная тема, скруглённые постеры, заметный фокус;
//  - на главной и в подборках над рядами большой блок с фоном, логотипом
//    и описанием фильма, на котором стоит фокус;
//  - в карточке фильма логотип вместо названия, цветной рейтинг, кнопки-«таблетки».
// Включается в Настройки → Интерфейс → «Интерфейс Neo». Флажок хранится
// в профиле (profiles.js), поэтому у каждого профиля свой выбор.
(function () {
    'use strict';

    if (window.neo_plugin) return;
    window.neo_plugin = true;

    var VERSION = '1.0.0';
    var SETTING = 'neo_enabled';
    var HERO_COMPONENTS = ['main', 'category'];

    var logos = {};
    var focusTimer = null;

    function enabled() {
        return Lampa.Storage.get(SETTING, false) === true || Lampa.Storage.get(SETTING, false) === 'true';
    }

    // ---------- стили ----------

    var CSS = [
        'body.neo{--neo-bg:#0b0c10;--neo-panel:rgba(20,21,26,.82);--neo-accent:#e50914;--neo-text:#f5f5f1;--neo-dim:#a3a3a3;background:var(--neo-bg)}',

        // левое меню: стекло и акцентная полоска у активного пункта
        'body.neo .menu{background:linear-gradient(90deg,rgba(11,12,16,.96),rgba(11,12,16,.6))}',
        'body.neo .menu__item{border-radius:12px}',
        'body.neo .menu__item.focus,body.neo .menu__item.hover{background:rgba(255,255,255,.12);box-shadow:inset 4px 0 0 var(--neo-accent)}',

        // постеры: скругление, мягкая тень, увеличение и рамка при фокусе
        'body.neo .card__view{border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.45);transition:transform .2s ease,box-shadow .2s ease}',
        'body.neo .card__img{border-radius:14px}',
        'body.neo .card.focus .card__view{transform:scale(1.07);box-shadow:0 0 0 3px var(--neo-accent),0 14px 34px rgba(0,0,0,.6)}',
        'body.neo .card.focus .card__view::after{display:none}',
        'body.neo .card__title{color:var(--neo-dim);font-size:1.05em}',
        'body.neo .card.focus .card__title{color:var(--neo-text)}',
        'body.neo .card__vote{border-radius:8px;font-weight:700}',
        'body.neo .card__vote.neo-good{background:#1db954;color:#fff}',
        'body.neo .card__vote.neo-mid{background:#f5a623;color:#111}',
        'body.neo .card__vote.neo-bad{background:#e0463b;color:#fff}',

        // заголовки рядов
        'body.neo .items-line__title{font-size:1.5em;font-weight:800;letter-spacing:.2px;color:var(--neo-text)}',

        // блок над рядами
        'body.neo .neo-host{position:relative}',
        'body.neo .neo-host .activity__body{padding-top:42vh;box-sizing:border-box}',
        '.neo-hero{position:absolute;left:0;right:0;top:0;height:50vh;overflow:hidden;pointer-events:none;z-index:0;-webkit-mask-image:linear-gradient(180deg,#000 55%,transparent 100%);mask-image:linear-gradient(180deg,#000 55%,transparent 100%)}',
        '.neo-hero__bg{position:absolute;inset:0;background-size:cover;background-position:center 20%;opacity:0;transition:opacity .5s ease}',
        '.neo-hero__bg.show{opacity:1}',
        '.neo-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.85) 0%,rgba(0,0,0,.6) 35%,rgba(0,0,0,0) 70%)}',
        '.neo-hero__info{position:absolute;left:3em;bottom:5.5em;width:46%;z-index:1}',
        '.neo-hero__logo{max-width:100%;max-height:7em;display:none;margin-bottom:.6em;filter:drop-shadow(0 4px 12px rgba(0,0,0,.6))}',
        '.neo-hero__title{font-size:2.8em;font-weight:900;line-height:1.05;color:var(--neo-text);margin-bottom:.35em;text-shadow:0 3px 14px rgba(0,0,0,.7)}',
        '.neo-hero__meta{font-size:1.15em;color:var(--neo-text);margin-bottom:.6em;display:flex;gap:.8em;align-items:center;flex-wrap:wrap}',
        '.neo-hero__rate{padding:.1em .5em;border-radius:6px;font-weight:800}',
        '.neo-hero__descr{font-size:1.1em;line-height:1.45;color:#d6d6d6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',

        // карточка фильма
        'body.neo .full-start-new__poster{border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.6)}',
        'body.neo .full-start-new__title{font-size:3.2em;font-weight:900;line-height:1.05}',
        'body.neo .full-start-new__title.neo-has-logo{font-size:0;line-height:0}',
        'body.neo .neo-full-logo{max-width:70%;max-height:9em;margin:.2em 0 .6em;display:block;filter:drop-shadow(0 4px 14px rgba(0,0,0,.7))}',
        'body.neo .full-start__button{border-radius:999px;background:rgba(255,255,255,.12);padding-left:1.3em;padding-right:1.3em}',
        'body.neo .full-start__button.focus{background:var(--neo-text);color:#000}',
        'body.neo .full-start__button.focus svg{color:#000}',
        'body.neo .full-start__button.button--play{background:var(--neo-accent);color:#fff}',
        'body.neo .full-start__button.button--play.focus{background:#fff;color:#000}',
        'body.neo .full-start__rate{border-radius:8px}'
    ].join('\n');

    function injectStyle() {
        if (document.getElementById('neo-style')) return;
        var style = document.createElement('style');
        style.id = 'neo-style';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    // ---------- данные карточек ----------

    function rateClass(vote) {
        vote = parseFloat(vote);
        if (!vote) return '';
        if (vote >= 7) return 'neo-good';
        if (vote >= 5.5) return 'neo-mid';
        return 'neo-bad';
    }

    function rateColor(vote) {
        return { 'neo-good': '#1db954', 'neo-mid': '#f5a623', 'neo-bad': '#e0463b' }[rateClass(vote)] || '';
    }

    function mediaType(data) {
        if (data.media_type) return data.media_type;
        return data.name && !data.title ? 'tv' : 'movie';
    }

    function year(data) {
        return ((data.release_date || data.first_air_date || '') + '').slice(0, 4);
    }

    // логотип фильма с TMDB (русский, иначе английский, иначе любой); кэшируем
    function loadLogo(data, done) {
        if (!data.id || data.source && data.source !== 'tmdb') return done('');

        var key = mediaType(data) + '_' + data.id;
        if (logos.hasOwnProperty(key)) return done(logos[key]);

        var lang = (Lampa.Storage.get('language', 'ru') + '').slice(0, 2);
        var url = Lampa.TMDB.api(mediaType(data) + '/' + data.id + '/images?api_key=' + Lampa.TMDB.key() +
            '&include_image_language=' + lang + ',en,null');

        var network = new Lampa.Reguest();
        network.silent(url, function (json) {
            var list = (json && json.logos) || [];
            var pick = null;
            [lang, 'en', null].some(function (l) {
                pick = list.filter(function (x) { return x.iso_639_1 === l; })[0];
                return !!pick;
            });
            pick = pick || list[0];
            logos[key] = pick ? Lampa.TMDB.image('t/p/w500' + pick.file_path.replace('.svg', '.png')) : '';
            done(logos[key]);
        }, function () {
            logos[key] = '';
            done('');
        });
    }

    // ---------- блок над рядами ----------

    function heroFor(activity) {
        var hero = activity.querySelector('.neo-hero');
        if (hero) return hero;

        hero = document.createElement('div');
        hero.className = 'neo-hero';
        hero.innerHTML = '<div class="neo-hero__bg"></div>' +
            '<div class="neo-hero__info">' +
            '<img class="neo-hero__logo">' +
            '<div class="neo-hero__title"></div>' +
            '<div class="neo-hero__meta"></div>' +
            '<div class="neo-hero__descr"></div>' +
            '</div>';
        activity.insertBefore(hero, activity.firstChild);
        activity.classList.add('neo-host');
        return hero;
    }

    function showHero(hero, data) {
        var title = data.title || data.name || '';
        var bg = hero.querySelector('.neo-hero__bg');
        var logo = hero.querySelector('.neo-hero__logo');
        var titleEl = hero.querySelector('.neo-hero__title');

        hero.neoId = data.id;

        titleEl.textContent = title;
        titleEl.style.display = '';
        logo.style.display = 'none';

        var meta = [];
        var vote = parseFloat(data.vote_average);
        if (vote) meta.push('<span class="neo-hero__rate" style="background:' + rateColor(vote) + '">' + vote.toFixed(1) + '</span>');
        if (year(data)) meta.push('<span>' + year(data) + '</span>');
        meta.push('<span>' + (mediaType(data) === 'tv' ? 'Сериал' : 'Фильм') + '</span>');
        if ((data.original_title || data.original_name) && (data.original_title || data.original_name) !== title) {
            meta.push('<span style="color:var(--neo-dim)">' + Lampa.Utils.shortText(data.original_title || data.original_name, 40) + '</span>');
        }
        hero.querySelector('.neo-hero__meta').innerHTML = meta.join('');
        hero.querySelector('.neo-hero__descr').textContent = data.overview || '';

        bg.classList.remove('show');
        if (data.backdrop_path) {
            var img = new Image();
            img.onload = function () {
                if (hero.neoId !== data.id) return;
                bg.style.backgroundImage = 'url(' + img.src + ')';
                bg.classList.add('show');
            };
            img.src = Lampa.Api.img(data.backdrop_path, 'w1280');
        }

        loadLogo(data, function (src) {
            if (!src || hero.neoId !== data.id) return;
            logo.onload = function () {
                if (hero.neoId !== data.id) return;
                logo.style.display = 'block';
                titleEl.style.display = 'none';
            };
            logo.src = src;
        });
    }

    function onCardFocus(e) {
        if (!document.body.classList.contains('neo')) return;

        var card = e.target;
        if (!card || !card.classList || !card.classList.contains('card') || !card.card_data) return;

        var vote = card.querySelector('.card__vote');
        if (vote && !vote.neoRated) {
            vote.neoRated = true;
            var cls = rateClass(vote.textContent);
            if (cls) vote.classList.add(cls);
        }

        var activity = card.closest ? card.closest('.activity') : null;
        if (!activity || !activity.classList.contains('neo-host')) return;

        clearTimeout(focusTimer);
        focusTimer = setTimeout(function () {
            showHero(heroFor(activity), card.card_data);
        }, 150);
    }

    function attach(object) {
        if (!enabled() || !object || HERO_COMPONENTS.indexOf(object.component) < 0) return;

        var render = object.activity && object.activity.render && object.activity.render(true);
        var el = render && render.jquery ? render[0] : render;
        if (el && el.classList) heroFor(el);
    }

    function onActivity(e) {
        if (e.type === 'start') attach(e.object);
    }

    // ---------- карточка фильма ----------

    function onFull(e) {
        if (e.type !== 'complite' || !enabled()) return;

        var body = e.body && e.body[0] ? e.body[0] : null;
        var data = e.data && e.data.movie;
        if (!body || !data) return;

        body.querySelectorAll('.full-start__rate.rate--tmdb').forEach(function (el) {
            var color = rateColor(el.textContent.replace(/[^\d.]/g, ''));
            if (color) el.style.background = color;
        });

        var title = body.querySelector('.full-start-new__title');
        if (!title || title.querySelector('.neo-full-logo')) return;

        loadLogo(data, function (src) {
            if (!src) return;
            var img = document.createElement('img');
            img.className = 'neo-full-logo';
            img.onload = function () {
                title.classList.add('neo-has-logo');
                title.parentNode.insertBefore(img, title);
            };
            img.src = src;
        });
    }

    // ---------- включение ----------

    function apply() {
        document.body.classList.toggle('neo', enabled());
    }

    function addSetting() {
        if (!Lampa.SettingsApi) return;

        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: { name: SETTING, type: 'trigger', default: false },
            field: {
                name: 'Интерфейс Neo',
                description: 'Тёмная тема, блок с описанием фильма над рядами, логотипы вместо названий. Хранится в профиле. После смены перезапустите Лампу.'
            },
            onChange: apply
        });
    }

    function init() {
        injectStyle();
        addSetting();
        apply();

        document.addEventListener('hover:focus', onCardFocus, true);
        Lampa.Listener.follow('activity', onActivity);
        Lampa.Listener.follow('full', onFull);

        // главная открывается раньше, чем загружаются плагины
        if (Lampa.Activity && Lampa.Activity.active) attach(Lampa.Activity.active());

        Lampa.Storage.listener.follow('change', function (e) {
            if (e.name === SETTING) apply();
        });
    }

    if (window.appready) init();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }

    window.neo_plugin_api = { version: VERSION };
})();

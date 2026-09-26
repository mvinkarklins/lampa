// «Neo» — новый интерфейс Лампы с темами: Netflix, Apple TV, Минимализм,
// Детская и Кинозал.
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

    var VERSION = '1.3.0';
    var SETTING = 'neo_enabled';
    var THEME = 'neo_theme';
    var HERO = 'neo_hero';
    var HERO_SIZES = { compact: 'Компактный', big: 'Большой', off: 'Выключен' };
    var CARDS = 'neo_cards';
    var CARD_SIZES = { small: 'Меньше', tiny: 'Мелкие', normal: 'Обычные' };
    var HERO_COMPONENTS = ['main', 'category'];

    var logos = {};
    var focusTimer = null;

    function enabled() {
        return Lampa.Storage.get(SETTING, false) === true || Lampa.Storage.get(SETTING, false) === 'true';
    }

    // ---------- стили ----------

    // Темы задают только переменные; каркас ниже общий для всех тем.
    var THEMES = {
        netflix: 'Netflix — тёмная, красный акцент',
        apple: 'Apple TV — светлое стекло, мягкий фокус',
        minimal: 'Минимализм — плоская, синий акцент',
        kids: 'Детская — яркая, крупные постеры',
        cinema: 'Кинозал — чёрная с золотом'
    };

    var CSS = [
        // ---- переменные тем ----
        'body.neo{--neo-bg:#0b0c10;--neo-tint:rgba(11,12,16,.55);--neo-head:rgba(11,12,16,.92);--neo-accent:#e50914;--neo-text:#f5f5f1;--neo-dim:#a3a3a3;' +
            '--neo-radius:14px;--neo-scale:1.07;--neo-focus:0 0 0 3px var(--neo-accent),0 14px 34px rgba(0,0,0,.6);' +
            '--neo-menu:linear-gradient(90deg,rgba(11,12,16,.96),rgba(11,12,16,.6));--neo-menu-focus:rgba(255,255,255,.12);--neo-menu-mark:inset 4px 0 0 var(--neo-accent);' +
            '--neo-hero-h:50vh;--neo-hero-pad:42vh;--neo-hero-shade:linear-gradient(90deg,rgba(0,0,0,.85) 0%,rgba(0,0,0,.6) 35%,rgba(0,0,0,0) 70%);--neo-hero-blur:0px;--neo-hero-title:2.8em;' +
            '--neo-weight:900;--neo-line-title:1.5em;' +
            '--neo-btn:rgba(255,255,255,.12);--neo-btn-text:#fff;--neo-btn-focus:#f5f5f1;--neo-btn-focus-text:#000;--neo-play:var(--neo-accent);--neo-play-text:#fff}',

        'body.neo-t-apple{--neo-bg:#1c1c1e;--neo-tint:rgba(44,44,46,.35);--neo-head:rgba(28,28,30,.7);--neo-accent:#ffffff;--neo-text:#fff;--neo-dim:#b0b0b5;' +
            '--neo-radius:20px;--neo-scale:1.1;--neo-focus:0 0 0 0 transparent,0 22px 48px rgba(0,0,0,.55),0 0 40px rgba(255,255,255,.18);' +
            '--neo-menu:rgba(44,44,46,.72);--neo-menu-focus:rgba(255,255,255,.9);--neo-menu-mark:none;' +
            '--neo-hero-h:56vh;--neo-hero-pad:46vh;--neo-hero-shade:linear-gradient(0deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,0) 60%);--neo-hero-blur:0px;--neo-hero-title:3.2em;' +
            '--neo-weight:700;--neo-line-title:1.35em;' +
            '--neo-btn:rgba(255,255,255,.18);--neo-btn-focus:#fff;--neo-btn-focus-text:#000;--neo-play:rgba(255,255,255,.28);--neo-play-text:#fff}',

        'body.neo-t-minimal{--neo-bg:#111214;--neo-tint:rgba(17,18,20,.88);--neo-head:#111214;--neo-accent:#4f8cff;--neo-text:#ececec;--neo-dim:#8a8d93;' +
            '--neo-radius:8px;--neo-scale:1.03;--neo-focus:0 0 0 2px var(--neo-accent);' +
            '--neo-menu:#111214;--neo-menu-focus:transparent;--neo-menu-mark:inset 3px 0 0 var(--neo-accent);' +
            '--neo-hero-h:40vh;--neo-hero-pad:33vh;--neo-hero-shade:linear-gradient(90deg,#111214 0%,rgba(17,18,20,.92) 45%,rgba(17,18,20,.55) 100%);--neo-hero-title:2.3em;' +
            '--neo-weight:600;--neo-line-title:1.2em;' +
            '--neo-btn:transparent;--neo-btn-focus:var(--neo-accent);--neo-btn-focus-text:#fff;--neo-play:transparent;--neo-play-text:var(--neo-text)}',

        'body.neo-t-kids{--neo-bg:#2b1055;--neo-tint:linear-gradient(135deg,rgba(117,81,194,.85),rgba(255,111,145,.75) 55%,rgba(255,199,95,.75));--neo-head:rgba(60,24,110,.85);' +
            '--neo-accent:#ffd400;--neo-text:#fff;--neo-dim:#fde7ff;' +
            '--neo-radius:26px;--neo-scale:1.12;--neo-focus:0 0 0 6px var(--neo-accent),0 16px 30px rgba(43,16,85,.55);' +
            '--neo-menu:rgba(60,24,110,.9);--neo-menu-focus:#ffd400;--neo-menu-mark:none;' +
            '--neo-hero-h:50vh;--neo-hero-pad:42vh;--neo-hero-shade:linear-gradient(90deg,rgba(60,24,110,.9) 0%,rgba(60,24,110,.55) 40%,rgba(60,24,110,0) 75%);--neo-hero-title:3em;' +
            '--neo-weight:900;--neo-line-title:1.7em;' +
            '--neo-btn:rgba(255,255,255,.22);--neo-btn-focus:#ffd400;--neo-btn-focus-text:#2b1055;--neo-play:#ff5d8f;--neo-play-text:#fff}',

        'body.neo-t-cinema{--neo-bg:#050505;--neo-tint:rgba(5,5,5,.72);--neo-head:rgba(5,5,5,.95);--neo-accent:#d4af37;--neo-text:#f3ead3;--neo-dim:#9c9380;' +
            '--neo-radius:4px;--neo-scale:1.06;--neo-focus:0 0 0 2px var(--neo-accent),0 0 28px rgba(212,175,55,.35);' +
            '--neo-menu:linear-gradient(90deg,#050505,rgba(5,5,5,.75));--neo-menu-focus:rgba(212,175,55,.14);--neo-menu-mark:inset 0 -2px 0 var(--neo-accent);' +
            '--neo-hero-h:58vh;--neo-hero-pad:49vh;--neo-hero-shade:linear-gradient(90deg,rgba(0,0,0,.92) 0%,rgba(0,0,0,.55) 45%,rgba(0,0,0,.15) 100%);--neo-hero-title:3.4em;' +
            '--neo-weight:800;--neo-line-title:1.35em;' +
            '--neo-btn:transparent;--neo-btn-focus:var(--neo-accent);--neo-btn-focus-text:#050505;--neo-play:transparent;--neo-play-text:var(--neo-accent)}',

        // ---- размер баннера (после тем, чтобы перекрывать их) ----
        'body.neo.neo-hero-compact{--neo-hero-h:33vh;--neo-hero-pad:26vh;--neo-hero-title:2.1em}',
        'body.neo.neo-hero-compact .neo-hero__info{bottom:3.2em;width:58%}',
        'body.neo.neo-hero-compact .neo-hero__logo{max-height:3.8em;margin-bottom:.4em}',
        'body.neo.neo-hero-compact .neo-hero__meta{font-size:1.05em;margin-bottom:.4em}',
        'body.neo.neo-hero-compact .neo-hero__descr{-webkit-line-clamp:2;font-size:1.02em}',
        'body.neo-t-apple.neo-hero-compact .neo-hero__info{width:auto;padding:0 15%}',
        'body.neo.neo-hero-off .neo-hero{display:none}',
        'body.neo.neo-hero-off .neo-host .activity__body{padding-top:0}',

        // ---- размер постеров в рядах (штатно 12.75em) ----
        'body.neo.neo-cards-small .items-line .card{width:10.2em}',
        'body.neo.neo-cards-tiny .items-line .card{width:8.6em}',
        'body.neo.neo-cards-tiny .items-line .card__title{font-size:.95em}',

        // ---- фон и шапка ----
        'body.neo{background:var(--neo-bg)}',
        'body.neo .background::after{content:"";position:fixed;inset:0;background:var(--neo-tint);pointer-events:none}',
        'body.neo .head__body{background:var(--neo-head)}',

        // ---- левое меню ----
        'body.neo .menu{background:var(--neo-menu)}',
        'body.neo .menu__item{border-radius:12px}',
        'body.neo .menu__item.focus,body.neo .menu__item.hover{background:var(--neo-menu-focus);box-shadow:var(--neo-menu-mark)}',
        'body.neo-t-apple .menu__item.focus,body.neo-t-apple .menu__item.hover{color:#000}',
        'body.neo-t-kids .menu__item.focus,body.neo-t-kids .menu__item.hover{color:#2b1055}',

        // ---- постеры ----
        'body.neo .card__view{border-radius:var(--neo-radius);overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.45);transition:transform .2s ease,box-shadow .2s ease}',
        'body.neo .card__img{border-radius:var(--neo-radius)}',
        'body.neo .card.focus .card__view{transform:scale(var(--neo-scale));box-shadow:var(--neo-focus)}',
        'body.neo .card.focus .card__view::after{display:none}',
        'body.neo .card__title{color:var(--neo-dim);font-size:1.05em}',
        'body.neo .card.focus .card__title{color:var(--neo-text)}',
        'body.neo-t-minimal .card__view{box-shadow:none}',
        'body.neo-t-kids .card__title{font-weight:800;font-size:1.2em;color:#fff}',
        'body.neo .card__vote{border-radius:8px;font-weight:700}',
        'body.neo .card__vote.neo-good{background:#1db954;color:#fff}',
        'body.neo .card__vote.neo-mid{background:#f5a623;color:#111}',
        'body.neo .card__vote.neo-bad{background:#e0463b;color:#fff}',

        // ---- заголовки рядов ----
        'body.neo .items-line__title{font-size:var(--neo-line-title);font-weight:var(--neo-weight);letter-spacing:.2px;color:var(--neo-text)}',
        'body.neo-t-cinema .items-line__title{text-transform:uppercase;letter-spacing:.18em;font-size:1.1em;color:var(--neo-accent)}',

        // ---- блок над рядами ----
        'body.neo .neo-host{position:relative}',
        'body.neo .neo-host .activity__body{padding-top:var(--neo-hero-pad);box-sizing:border-box}',
        '.neo-hero{position:absolute;left:0;right:0;top:0;height:var(--neo-hero-h);overflow:hidden;pointer-events:none;z-index:0;-webkit-mask-image:linear-gradient(180deg,#000 55%,transparent 100%);mask-image:linear-gradient(180deg,#000 55%,transparent 100%)}',
        '.neo-hero__bg{position:absolute;inset:0;background-size:cover;background-position:center 20%;opacity:0;transition:opacity .5s ease}',
        '.neo-hero__bg.show{opacity:1}',
        '.neo-hero::after{content:"";position:absolute;inset:0;background:var(--neo-hero-shade)}',
        '.neo-hero__info{position:absolute;left:3em;bottom:5.5em;width:46%;z-index:1}',
        // логотипы белым силуэтом: у TMDB бывают тёмные логотипы, а цвет картинки из-за CORS не прочитать
        '.neo-hero__logo{max-width:100%;max-height:7em;display:none;margin-bottom:.6em;filter:brightness(0) invert(1) drop-shadow(0 4px 12px rgba(0,0,0,.6))}',
        '.neo-hero__title{font-size:var(--neo-hero-title);font-weight:var(--neo-weight);line-height:1.05;color:var(--neo-text);margin-bottom:.35em;text-shadow:0 3px 14px rgba(0,0,0,.7)}',
        '.neo-hero__meta{font-size:1.15em;color:var(--neo-text);margin-bottom:.6em;display:flex;gap:.8em;align-items:center;flex-wrap:wrap}',
        '.neo-hero__rate{padding:.1em .5em;border-radius:6px;font-weight:800}',
        '.neo-hero__descr{font-size:1.1em;line-height:1.45;color:var(--neo-text);opacity:.85;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
        // Apple TV: описание по центру снизу, Кинозал: тонкая золотая линия
        'body.neo-t-apple .neo-hero__info{left:0;right:0;width:auto;text-align:center;bottom:4.5em;padding:0 20%}',
        'body.neo-t-apple .neo-hero__logo{margin-left:auto;margin-right:auto}',
        'body.neo-t-apple .neo-hero__meta{justify-content:center}',
        'body.neo-t-cinema .neo-hero__meta{letter-spacing:.08em;text-transform:uppercase;font-size:1em;color:var(--neo-accent)}',
        'body.neo-t-cinema .neo-hero__info::before{content:"";display:block;width:4em;height:2px;background:var(--neo-accent);margin-bottom:1em}',
        // минимализм: текстовое название вместо логотипа, описание в две строки
        'body.neo-t-minimal .neo-hero__logo{display:none!important}',
        'body.neo-t-minimal .neo-hero__title{display:block!important}',
        'body.neo-t-minimal .neo-hero__descr{-webkit-line-clamp:2}',
        'body.neo-t-minimal .neo-hero__info{bottom:4em}',
        'body.neo-t-kids .neo-hero__title{color:#ffd400;text-shadow:0 4px 0 #ff5d8f,0 8px 18px rgba(43,16,85,.6)}',

        // ---- карточка фильма ----
        'body.neo .full-start-new__poster{border-radius:calc(var(--neo-radius) + 4px);overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.6)}',
        'body.neo .full-start-new__title{font-size:3.2em;font-weight:var(--neo-weight);line-height:1.05;color:var(--neo-text)}',
        'body.neo .full-start-new__title.neo-has-logo{font-size:0;line-height:0}',
        'body.neo .neo-full-logo{max-width:70%;max-height:9em;margin:.2em 0 .6em;display:block;filter:brightness(0) invert(1) drop-shadow(0 4px 14px rgba(0,0,0,.7))}',
        // в детской теме логотипы цветные, с белой обводкой
        'body.neo-t-kids .neo-hero__logo,body.neo-t-kids .neo-full-logo{filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 2px #fff) drop-shadow(0 6px 14px rgba(43,16,85,.6))}',
        'body.neo .full-start__button{border-radius:999px;background:var(--neo-btn);color:var(--neo-btn-text);padding-left:1.3em;padding-right:1.3em}',
        'body.neo .full-start__button.focus{background:var(--neo-btn-focus);color:var(--neo-btn-focus-text)}',
        'body.neo .full-start__button.focus svg{color:var(--neo-btn-focus-text)}',
        'body.neo .full-start__button.button--play{background:var(--neo-play);color:var(--neo-play-text)}',
        'body.neo .full-start__button.button--play.focus{background:var(--neo-btn-focus);color:var(--neo-btn-focus-text)}',
        'body.neo-t-minimal .full-start__button,body.neo-t-cinema .full-start__button{box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}',
        'body.neo-t-cinema .full-start__button{border-radius:2px;box-shadow:inset 0 0 0 1px var(--neo-accent)}',
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

    function genreNames(data) {
        try {
            var names = Lampa.Api.sources.tmdb.getGenresNameFromIds(mediaType(data), data.genre_ids || []);
            return names.slice(0, 3).join(' · ');
        } catch (e) {
            return '';
        }
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
        var genres = genreNames(data);
        if (genres) meta.push('<span>' + genres + '</span>');
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

    function theme() {
        var t = Lampa.Storage.get(THEME, 'netflix') + '';
        return THEMES[t] ? t : 'netflix';
    }

    function apply() {
        var on = enabled();
        var cls = document.body.classList;

        var hero = Lampa.Storage.get(HERO, 'compact') + '';
        if (!HERO_SIZES[hero]) hero = 'compact';

        cls.toggle('neo', on);
        Object.keys(THEMES).forEach(function (t) { cls.toggle('neo-t-' + t, on && t === theme()); });
        Object.keys(HERO_SIZES).forEach(function (h) { cls.toggle('neo-hero-' + h, on && h === hero); });

        var cards = Lampa.Storage.get(CARDS, 'small') + '';
        if (!CARD_SIZES[cards]) cards = 'small';
        Object.keys(CARD_SIZES).forEach(function (c) { cls.toggle('neo-cards-' + c, on && c === cards); });
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

        var names = {};
        Object.keys(THEMES).forEach(function (t) { names[t] = THEMES[t].split(' — ')[0]; });

        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: { name: THEME, type: 'select', values: names, default: 'netflix' },
            field: {
                name: 'Тема Neo',
                description: 'Netflix, Apple TV, Минимализм, Детская или Кинозал. Хранится в профиле.'
            },
            onChange: apply
        });

        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: { name: HERO, type: 'select', values: HERO_SIZES, default: 'compact' },
            field: {
                name: 'Баннер Neo',
                description: 'Блок с описанием фильма над рядами: компактный, большой или выключен.'
            },
            onChange: apply
        });

        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: { name: CARDS, type: 'select', values: CARD_SIZES, default: 'small' },
            field: {
                name: 'Постеры Neo',
                description: 'Размер постеров в рядах: меньше, мелкие или обычные.'
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
            if ([SETTING, THEME, HERO, CARDS].indexOf(e.name) >= 0) apply();
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

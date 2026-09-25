// Кнопка «Торренты» прямо на карточке фильма, рядом с «Смотреть».
// Штатно её можно закрепить долгим нажатием в окне выбора источника,
// но на пультах LG долгое нажатие не срабатывает.
(function () {
    'use strict';

    if (window.torrent_button_plugin) return;
    window.torrent_button_plugin = true;

    Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'complite') return;

        var body = e.body;
        var source = body.find('.buttons--container .view--torrent');
        var row = body.find('.full-start-new__buttons');

        // Парсер выключен или торренты скрыты сборкой — кнопки нет.
        if (!source.length || source.hasClass('hide') || !row.length) return;
        if (row.find('.button--torrent-direct').length) return;

        var button = source.clone()
            .removeClass('view--torrent hide')
            .addClass('selector button--torrent-direct');

        button.on('hover:enter', function () {
            source.trigger('hover:enter');
        });

        var play = row.find('.button--play');

        if (play.length) play.after(button);
        else row.prepend(button);

        var active = Lampa.Controller.enabled();

        if (active && active.name === 'full_start') Lampa.Controller.toggle('full_start');
    });
})();

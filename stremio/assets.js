/*
 * Иконка и фон дополнения. Рисуются из SVG при первом запросе.
 */
'use strict';

var sharp = require('sharp');

var LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#FFB347"/><stop offset="1" stop-color="#FF5E8A"/></linearGradient></defs>' +
    '<rect width="512" height="512" rx="116" fill="url(#g)"/>' +
    // медвежонок
    '<circle cx="158" cy="170" r="68" fill="#8A5634"/><circle cx="158" cy="170" r="36" fill="#F4C9A0"/>' +
    '<circle cx="354" cy="170" r="68" fill="#8A5634"/><circle cx="354" cy="170" r="36" fill="#F4C9A0"/>' +
    '<circle cx="256" cy="286" r="156" fill="#9C6644"/>' +
    '<ellipse cx="256" cy="338" rx="84" ry="64" fill="#F6D8B8"/>' +
    '<ellipse cx="256" cy="310" rx="28" ry="20" fill="#3A2317"/>' +
    '<circle cx="198" cy="252" r="17" fill="#3A2317"/><circle cx="204" cy="246" r="5.5" fill="#fff"/>' +
    '<circle cx="314" cy="252" r="17" fill="#3A2317"/><circle cx="320" cy="246" r="5.5" fill="#fff"/>' +
    '<path d="M230 350 Q256 374 282 350" stroke="#3A2317" stroke-width="9" fill="none" stroke-linecap="round"/>' +
    '<circle cx="170" cy="316" r="16" fill="#FF8FA3" opacity=".7"/><circle cx="342" cy="316" r="16" fill="#FF8FA3" opacity=".7"/>' +
    // звёздочка
    '<polygon points="432,52 443,80 473,82 450,101 457,130 432,114 407,130 414,101 391,82 421,80" fill="#FFF3B0"/>' +
    '</svg>';

// Детерминированный «случайный» узор, чтобы фон всегда был одинаковым
function rng(seed) {
    return function () {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    };
}

function backgroundSvg() {
    var r = rng(42), w = 1920, h = 1080;
    var shapes = '';
    var colors = ['#FFB347', '#FF5E8A', '#7BDFF2', '#B2F7EF', '#FFF3B0'];

    for (var i = 0; i < 14; i++) {
        shapes += '<circle cx="' + Math.round(r() * w) + '" cy="' + Math.round(r() * h) + '" r="' + Math.round(40 + r() * 170) +
            '" fill="' + colors[i % colors.length] + '" opacity="' + (0.06 + r() * 0.1).toFixed(2) + '"/>';
    }

    for (var j = 0; j < 90; j++) {
        shapes += '<circle cx="' + Math.round(r() * w) + '" cy="' + Math.round(r() * h * 0.8) + '" r="' + (1 + r() * 2.5).toFixed(1) +
            '" fill="#fff" opacity="' + (0.25 + r() * 0.6).toFixed(2) + '"/>';
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#1E1B4B"/><stop offset=".55" stop-color="#4C2A85"/><stop offset="1" stop-color="#B3477A"/>' +
        '</linearGradient></defs>' +
        '<rect width="' + w + '" height="' + h + '" fill="url(#g)"/>' + shapes +
        // холмы
        '<path d="M0 900 Q300 780 620 870 T1260 850 T1920 820 V1080 H0Z" fill="#2A1F5C" opacity=".85"/>' +
        '<path d="M0 980 Q420 880 860 960 T1920 930 V1080 H0Z" fill="#171338"/>' +
        '<circle cx="1620" cy="190" r="90" fill="#FFF3B0" opacity=".9"/><circle cx="1655" cy="170" r="80" fill="#3E2677"/>' +
        '</svg>';
}

var cache = {};

function once(name, make) {
    if (!cache[name]) {
        cache[name] = make().catch(function (e) {
            delete cache[name];
            throw e;
        });
    }
    return cache[name];
}

function logo() {
    return once('logo', function () {
        return sharp(Buffer.from(LOGO)).resize(256, 256).png().toBuffer();
    });
}

function background() {
    return once('background', function () {
        return sharp(Buffer.from(backgroundSvg())).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    });
}

module.exports = { logo: logo, background: background, LOGO: LOGO };

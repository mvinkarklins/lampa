/*
 * Иконка и фон дополнения. Рисуются из SVG при первом запросе.
 */
'use strict';

var sharp = require('sharp');

var LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#FF8A3D"/><stop offset="1" stop-color="#E0245E"/></linearGradient></defs>' +
    '<rect width="512" height="512" rx="116" fill="url(#g)"/>' +
    // кинохлопушка: корпус
    '<rect x="96" y="214" width="320" height="200" rx="22" fill="#1C1633"/>' +
    '<rect x="96" y="214" width="320" height="46" fill="#2C2450"/>' +
    '<path d="M128 214 L162 260 M200 214 L234 260 M272 214 L306 260 M344 214 L378 260" stroke="#fff" stroke-width="22" stroke-linecap="butt"/>' +
    // верхняя планка, чуть открыта
    '<g transform="rotate(-14 110 196)">' +
    '<rect x="96" y="150" width="320" height="46" rx="10" fill="#2C2450"/>' +
    '<path d="M134 150 L168 196 M206 150 L240 196 M278 150 L312 196 M350 150 L384 196" stroke="#fff" stroke-width="22"/>' +
    '</g>' +
    '<circle cx="110" cy="198" r="14" fill="#FFD166"/>' +
    // звезда
    '<polygon points="256,286 272,322 311,325 281,350 291,388 256,367 221,388 231,350 201,325 240,322" fill="#FFD166"/>' +
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
        '<stop offset="0" stop-color="#0F0C1D"/><stop offset=".6" stop-color="#2A1745"/><stop offset="1" stop-color="#7A1E48"/>' +
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

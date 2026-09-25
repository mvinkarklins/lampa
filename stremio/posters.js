/*
 * Постеры с метками: возраст («6+») слева сверху и оценка TMDB справа.
 * Картинку берём у TMDB, рисуем метки и держим результат в кэше (память + диск).
 */
'use strict';

var fs = require('fs');
var path = require('path');
var sharp = require('sharp');

var IMG = 'https://image.tmdb.org/t/p/';
var CACHE_DIR = process.env.CACHE_DIR || '';
var MEM_MAX = 300;

sharp.cache({ memory: 32, items: 50 });
sharp.concurrency(2);

var COLORS = { 0: '#1FA35B', 6: '#2E7CF6', 7: '#2E7CF6', 10: '#8B5CF6', 12: '#EE8A0B', 16: '#E5484D', 18: '#B4152B' };

var mem = new Map();
var pending = new Map();

if (CACHE_DIR) {
    try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch (e) { CACHE_DIR = ''; }
}

function star(cx, cy, r) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
        var rr = i % 2 ? r * 0.46 : r;
        var a = Math.PI / 5 * i - Math.PI / 2;
        pts.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1));
    }
    return pts.join(' ');
}

function badges(w, h, label, rating) {
    var s = Math.min(w / 342, h / 400);
    var fs_ = 21 * s, ph = 36 * s, r = ph / 2, pad = 12 * s, m = 10 * s;
    var font = 'font-family="DejaVu Sans" font-weight="bold" font-size="' + fs_.toFixed(1) + '"';
    var ty = (m + r + fs_ * 0.36).toFixed(1);

    var age = label + '+';
    var aw = pad * 2 + age.length * fs_ * 0.66;
    var pill = label < 0 ? '' :
        '<rect x="' + m + '" y="' + m + '" width="' + aw.toFixed(1) + '" height="' + ph.toFixed(1) + '" rx="' + r.toFixed(1) + '"' +
        ' fill="' + (COLORS[label] || COLORS[6]) + '" stroke="#fff" stroke-width="' + (2.5 * s).toFixed(1) + '"/>' +
        '<text x="' + (m + aw / 2).toFixed(1) + '" y="' + ty + '" ' + font + ' fill="#fff" text-anchor="middle">' + age + '</text>';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' +
        '<defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        '<rect width="' + w + '" height="' + (ph + m * 3).toFixed(1) + '" fill="url(#t)"/>' + pill;

    if (rating >= 10) {
        var txt = (rating / 10).toFixed(1);
        var sr = 9 * s;
        var rw = pad + sr * 2 + 5 * s + txt.length * fs_ * 0.6 + pad * 0.8;
        var rx = w - m - rw;
        svg += '<rect x="' + rx.toFixed(1) + '" y="' + m + '" width="' + rw.toFixed(1) + '" height="' + ph.toFixed(1) + '" rx="' + r.toFixed(1) + '" fill="#000" fill-opacity=".62"/>' +
            '<polygon points="' + star(rx + pad + sr, m + r, sr) + '" fill="#FFC53D"/>' +
            '<text x="' + (rx + pad + sr * 2 + 5 * s).toFixed(1) + '" y="' + ty + '" ' + font + ' fill="#fff">' + txt + '</text>';
    }

    return Buffer.from(svg + '</svg>');
}

function remember(key, buf) {
    mem.set(key, buf);
    if (mem.size > MEM_MAX) mem.delete(mem.keys().next().value);
}

function render(label, rating, size, file) {
    return fetch(IMG + size + '/' + file).then(function (res) {
        if (!res.ok) throw new Error('TMDB image ' + res.status);
        return res.arrayBuffer();
    }).then(function (ab) {
        var img = sharp(Buffer.from(ab));
        return img.metadata().then(function (meta) {
            return img
                .composite([{ input: badges(meta.width, meta.height, label, rating), top: 0, left: 0 }])
                .jpeg({ quality: 84, mozjpeg: true })
                .toBuffer();
        });
    });
}

// label — возраст (0, 6, 12…, −1 — без метки возраста), rating — оценка ×10, size — w342/w780, file — имя файла TMDB
function poster(label, rating, size, file) {
    var key = [label, rating, size, file.replace(/\.\w+$/, '')].join('_');

    if (mem.has(key)) {
        var buf = mem.get(key);
        mem.delete(key);
        mem.set(key, buf);
        return Promise.resolve(buf);
    }

    if (pending.has(key)) return pending.get(key);

    var diskPath = CACHE_DIR ? path.join(CACHE_DIR, key + '.jpg') : '';

    var p = new Promise(function (resolve) {
        if (!diskPath) return resolve(null);
        fs.readFile(diskPath, function (err, data) { resolve(err ? null : data); });
    }).then(function (cached) {
        if (cached) return cached;
        return render(label, rating, size, file).then(function (out) {
            if (diskPath) fs.writeFile(diskPath, out, function () {});
            return out;
        });
    }).then(function (out) {
        remember(key, out);
        pending.delete(key);
        return out;
    }, function (e) {
        pending.delete(key);
        throw e;
    });

    pending.set(key, p);
    return p;
}

module.exports = { poster: poster, badges: badges };

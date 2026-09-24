'use strict';

var http = require('http');
var addon = require('./addon');
var posters = require('./posters');
var assets = require('./assets');

var PORT = process.env.PORT || 7000;
var PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');

if (!process.env.TMDB_API_KEY) {
    console.warn('Внимание: не задан TMDB_API_KEY — каталоги будут пустыми.');
}

// Адрес сервера для ссылок на постеры и иконку
function baseUrl(req) {
    if (PUBLIC_URL) return PUBLIC_URL;
    var proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0];
    return proto + '://' + req.headers.host;
}

function send(res, status, body, type, maxAge) {
    var headers = {
        'Content-Type': type,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
    };
    if (maxAge) headers['Cache-Control'] = 'public, max-age=' + maxAge;
    res.writeHead(status, headers);
    res.end(body);
}

function json(res, status, body) {
    send(res, status, JSON.stringify(body), 'application/json; charset=utf-8');
}

function binary(res, promise, type, maxAge) {
    promise.then(function (buf) {
        send(res, 200, buf, type, maxAge);
    }).catch(function (e) {
        console.error(e.message);
        json(res, 500, { err: 'failed' });
    });
}

var CATALOG_ROUTE = /^\/catalog\/([^/]+)\/([^/]+?)(?:\/([^/]+))?\.json$/;
var POSTER_ROUTE = /^\/poster\/(\d{1,2})\/(\d{1,3})\/(w342|w780)\/([A-Za-z0-9_-]+\.(?:jpg|png))$/;

var server = http.createServer(function (req, res) {
    if (req.method === 'OPTIONS') return send(res, 204, '', 'text/plain');

    var url = req.url.split('?')[0];
    var m;

    if (url === '/logo.png' || url === '/favicon.ico') return binary(res, assets.logo(), 'image/png', 86400);
    if (url === '/background.jpg') return binary(res, assets.background(), 'image/jpeg', 86400);

    if ((m = url.match(POSTER_ROUTE))) {
        var label = +m[1], rating = +m[2], size = m[3], file = m[4];
        return posters.poster(label, rating, size, file).then(function (buf) {
            send(res, 200, buf, 'image/jpeg', 7 * 86400);
        }).catch(function (e) {
            // не получилось нарисовать метки — отдаём исходный постер
            console.error(e.message);
            res.writeHead(302, { Location: 'https://image.tmdb.org/t/p/' + size + '/' + file });
            res.end();
        });
    }

    if (url === '/' || url === '/manifest.json') return json(res, 200, addon.manifest(baseUrl(req)));

    // /catalog/{type}/{id}.json  или  /catalog/{type}/{id}/{extra}.json
    if ((m = url.match(CATALOG_ROUTE))) {
        return addon.catalog(m[1], m[2], addon.parseExtra(m[3]), baseUrl(req)).then(function (result) {
            if (!result) return json(res, 404, { err: 'not found' });
            json(res, 200, result);
        }).catch(function (e) {
            console.error(e.message);
            json(res, 200, { metas: [] });
        });
    }

    json(res, 404, { err: 'not found' });
});

server.listen(PORT, function () {
    console.log('Дополнение запущено: http://127.0.0.1:' + PORT + '/manifest.json');
});

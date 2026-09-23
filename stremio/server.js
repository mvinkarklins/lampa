'use strict';

var http = require('http');
var addon = require('./addon');

var PORT = process.env.PORT || 7000;

if (!process.env.TMDB_API_KEY) {
    console.warn('Внимание: не задан TMDB_API_KEY — каталоги будут пустыми.');
}

function send(res, status, body) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
    });
    res.end(JSON.stringify(body));
}

var server = http.createServer(function (req, res) {
    if (req.method === 'OPTIONS') return send(res, 204, {});

    var path = req.url.split('?')[0];

    if (path === '/' || path === '/manifest.json') return send(res, 200, addon.manifest);

    // /catalog/{type}/{id}.json  или  /catalog/{type}/{id}/{extra}.json
    var m = path.match(/^\/catalog\/([^/]+)\/([^/]+?)(?:\/([^/]+))?\.json$/);

    if (m) {
        return addon.catalog(m[1], m[2], addon.parseExtra(m[3])).then(function (result) {
            if (!result) return send(res, 404, { err: 'not found' });
            send(res, 200, result);
        }).catch(function (e) {
            console.error(e.message);
            send(res, 200, { metas: [] });
        });
    }

    send(res, 404, { err: 'not found' });
});

server.listen(PORT, function () {
    console.log('Дополнение запущено: http://127.0.0.1:' + PORT + '/manifest.json');
});

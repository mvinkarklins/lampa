'use strict';

// Lampa profile sync server. Stores JSON files in DATA_DIR:
//   profiles.json — list of profiles
//   shared.json   — shared settings (TorrServer, parser)
//   p_<id>.json   — profile data (bookmarks, history, timecodes)
// Each value is stored as {v: localStorage string, t: change time in ms};
// on merge the later time wins.

var http = require('http');
var fs = require('fs');
var path = require('path');
var stats = require('./stats');

var PORT = process.env.PORT || 8080;
var DATA_DIR = process.env.DATA_DIR || '/data';
// set at image build time (see .github/workflows/check.yml); "dev" for local runs
var VERSION = process.env.APP_VERSION || 'dev';
var MAX_BODY = 20 * 1024 * 1024;
var ID_RE = /^[a-z0-9_-]{1,32}$/;

function file(name) {
    return path.join(DATA_DIR, name + '.json');
}

function readJson(name, empty) {
    try {
        return JSON.parse(fs.readFileSync(file(name), 'utf8'));
    } catch (e) {
        return empty;
    }
}

// write via a temp file so a crash never leaves truncated JSON
function writeJson(name, data) {
    var tmp = file(name) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file(name));
}

function send(res, status, body) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Private-Network': 'true',
        'Cache-Control': 'no-store'
    });
    res.end(body === undefined ? '' : JSON.stringify(body));
}

function readBody(req, done) {
    var chunks = [];
    var size = 0;

    req.on('data', function (c) {
        size += c.length;
        if (size > MAX_BODY) {
            req.destroy();
            return;
        }
        chunks.push(c);
    });

    req.on('end', function () {
        try {
            done(null, JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
        } catch (e) {
            done(e);
        }
    });
}

function isEntry(e) {
    return e && typeof e.v === 'string' && typeof e.t === 'number';
}

// merge incoming values with stored ones and return the result
function merge(scope, incoming) {
    var store = readJson(scope, {});
    var changed = false;

    Object.keys(incoming || {}).forEach(function (key) {
        var e = incoming[key];
        if (!isEntry(e)) return;
        if (!store[key] || e.t > store[key].t) {
            store[key] = { v: e.v, t: e.t };
            changed = true;
        }
    });

    if (changed) writeJson(scope, store);
    return store;
}

function scopeName(id) {
    return id === 'shared' ? 'shared' : 'p_' + id;
}

var server = http.createServer(function (req, res) {
    var url = req.url.split('?')[0];

    // request log: who (IP, device) accesses which profile
    if (req.method !== 'OPTIONS' && url !== '/health') {
        var ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').replace('::ffff:', '');
        var ua = String(req.headers['user-agent'] || '').replace(/^Mozilla\/5\.0 /, '').slice(0, 60);
        res.on('finish', function () {
            console.log(new Date().toISOString().slice(11, 19) + ' ' + ip + ' ' + req.method + ' ' + url + ' ' + res.statusCode + ' ' + (req.bodyKeys || '') + ' | ' + ua);
        });
    }
    var parts = url.split('/').filter(Boolean);

    if (req.method === 'OPTIONS') return send(res, 204);

    if (url === '/health') return send(res, 200, { ok: true, version: VERSION });

    // GET /api/profiles, PUT /api/profiles
    if (parts[0] === 'api' && parts[1] === 'profiles' && parts.length === 2) {
        if (req.method === 'GET') return send(res, 200, readJson('profiles', { profiles: [] }));

        if (req.method === 'PUT') {
            return readBody(req, function (err, body) {
                if (err || !Array.isArray(body.profiles)) return send(res, 400, { error: 'bad body' });

                var profiles = body.profiles.filter(function (p) {
                    return p && ID_RE.test(p.id) && typeof p.name === 'string';
                }).map(function (p) {
                    return { id: p.id, name: p.name.slice(0, 40), kids: !!p.kids };
                });

                writeJson('profiles', { profiles: profiles });
                send(res, 200, { profiles: profiles });
            });
        }
    }

    // GET /api/stats/<id> — top genres, recently watched, total minutes for one profile
    if (parts[0] === 'api' && parts[1] === 'stats' && parts.length === 3 && ID_RE.test(parts[2]) && parts[2] !== 'shared') {
        if (req.method === 'GET') return send(res, 200, stats.computeStats(readJson(scopeName(parts[2]), {})));
    }

    // GET|POST|DELETE /api/store/<shared|id>
    if (parts[0] === 'api' && parts[1] === 'store' && parts.length === 3 && ID_RE.test(parts[2])) {
        var scope = scopeName(parts[2]);

        if (req.method === 'GET') return send(res, 200, readJson(scope, {}));

        if (req.method === 'POST') {
            return readBody(req, function (err, body) {
                if (err) return send(res, 400, { error: 'bad body' });
                req.bodyKeys = Object.keys(body).join(',');
                send(res, 200, merge(scope, body));
            });
        }

        if (req.method === 'DELETE' && scope !== 'shared') {
            try { fs.unlinkSync(file(scope)); } catch (e) {}
            return send(res, 200, { ok: true });
        }
    }

    send(res, 404, { error: 'not found' });
});

fs.mkdirSync(DATA_DIR, { recursive: true });

server.listen(PORT, function () {
    console.log('lampa-sync ' + VERSION + ' listening on port ' + PORT + ', data in ' + DATA_DIR);
});

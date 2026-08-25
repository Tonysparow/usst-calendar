/* ============================================================
   上理日历 · 本地同步服务
   提供静态页面 + 更新接口，浏览器每日自动检查新事件：
     GET  /             静态页面（index.html）
     GET  /api/status   上次检查时间与事件数
     GET  /api/events   全部实时事件
     GET  /api/update   立即执行一次更新并返回结果
   启动：node server.js   （默认 127.0.0.1:3030）
   ============================================================ */
'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var updater = require('./tools/update-events.js');

var ROOT = __dirname;
var PORT = Number(process.env.PORT || 3030);
var HOST = process.env.HOST || '127.0.0.1';

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(obj));
}

function readLive() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'js', 'live-events.json'), 'utf-8'));
  } catch (e) {
    return { checkedAt: null, events: [] };
  }
}

function serveStatic(req, res, pathname) {
  var filePath = pathname === '/' ? path.join(ROOT, 'index.html') : path.join(ROOT, pathname);
  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

var server = http.createServer(function (req, res) {
  var url;
  try { url = new URL(req.url, 'http://' + req.headers.host); }
  catch (e) { sendJson(res, 400, { ok: false, error: 'bad url' }); return; }

  var p = url.pathname;
  if (p === '/api/status') {
    var live = readLive();
    sendJson(res, 200, { ok: true, checkedAt: live.checkedAt, count: live.events.length });
  } else if (p === '/api/events') {
    sendJson(res, 200, Object.assign({ ok: true }, readLive()));
  } else if (p === '/api/update') {
    updater.runUpdate()
      .then(function (result) {
        sendJson(res, 200, Object.assign({ ok: true }, result, readLive()));
      })
      .catch(function (err) {
        sendJson(res, 500, { ok: false, error: err && err.message ? err.message : String(err) });
      });
  } else {
    serveStatic(req, res, decodeURIComponent(p));
  }
});

server.listen(PORT, HOST, function () {
  console.log('上理日历本地服务已启动：http://' + HOST + ':' + PORT);
});

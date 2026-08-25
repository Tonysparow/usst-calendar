/* ============================================================
   上理日历 · 桌面启动器
   确保本地同步服务已启动，然后用 Edge 应用窗口打开日历。
   用法：node tools/launch.js
   ============================================================ */
'use strict';

var net = require('net');
var child = require('child_process');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var HOST = '127.0.0.1';
var PORT = Number(process.env.PORT || 3030);
var EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function isUp() {
  return new Promise(function (resolve) {
    var sock = net.connect({ host: HOST, port: PORT });
    sock.once('connect', function () { sock.destroy(); resolve(true); });
    sock.once('error', function () { resolve(false); });
  });
}

function waitUp(times, delayMs) {
  return new Promise(function (resolve) {
    if (times <= 0) { resolve(false); return; }
    isUp().then(function (up) {
      if (up) { resolve(true); return; }
      setTimeout(function () { waitUp(times - 1, delayMs).then(resolve); }, delayMs);
    });
  });
}

function openBrowser(url) {
  var fs = require('fs');
  var edge = fs.existsSync(EDGE) ? EDGE : 'msedge';
  child.spawn(edge, ['--app=' + url], { detached: true, stdio: 'ignore' }).unref();
}

async function main() {
  var up = await isUp();
  if (!up) {
    var node = process.execPath;
    child.spawn(node, [path.join(ROOT, 'server.js')], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref();
    up = await waitUp(12, 500);
  }
  if (up) {
    openBrowser('http://' + HOST + ':' + PORT + '/');
  } else {
    // 服务起不来时退回到直接打开本地文件
    var fileUrl = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
    openBrowser(fileUrl);
  }
}

main();

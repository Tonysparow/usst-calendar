/* 上理日历 · PWA 资源校验（manifest / 图标 / Service Worker / 页面集成） */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var tests = [];

function t(name, fn) { tests.push({ name: name, fn: fn }); }

t('manifest.webmanifest 字段完整且可解析', function () {
  var raw = fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf-8');
  var m = JSON.parse(raw);
  if (!m.name || !m.short_name) throw new Error('缺少应用名称');
  if (m.display !== 'standalone') throw new Error('display 应为 standalone');
  if (!m.start_url || !m.scope) throw new Error('缺少 start_url/scope');
  if (!Array.isArray(m.icons) || m.icons.length < 2) throw new Error('缺少图标');
  m.icons.forEach(function (icon) {
    if (!/^\d+x\d+$/.test(icon.sizes)) throw new Error('图标 sizes 格式错误：' + icon.sizes);
  });
});

t('图标文件存在且尺寸正确', function () {
  [['icon-192.png', 192], ['icon-512.png', 512]].forEach(function (pair) {
    var file = path.join(ROOT, 'icons', pair[0]);
    var buf = fs.readFileSync(file);
    if (buf.length < 24) throw new Error(pair[0] + ' 文件过小');
    if (buf.toString('ascii', 1, 4) !== 'PNG') throw new Error(pair[0] + ' 不是 PNG');
    var w = buf.readUInt32BE(16);
    var h = buf.readUInt32BE(20);
    if (w !== pair[1] || h !== pair[1]) throw new Error(pair[0] + ' 尺寸应为 ' + pair[1] + 'x' + pair[1] + '，实际 ' + w + 'x' + h);
  });
});

t('sw.js 语法有效且包含必要逻辑', function () {
  var code = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf-8');
  // 语法检查：把脚本包成函数体（self 为运行时全局，仅做语法验证）
  new Function(code);
  if (code.indexOf('addEventListener') === -1) throw new Error('缺少事件监听');
  if (code.indexOf('live-events') === -1) throw new Error('缺少 live-events 更新处理');
});

t('index.html 已集成 PWA 资源', function () {
  var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
  if (html.indexOf('manifest.json') === -1) throw new Error('缺少 manifest 链接');
  if (html.indexOf('theme-color') === -1) throw new Error('缺少 theme-color');
  if (html.indexOf('viewport-fit=cover') === -1) throw new Error('缺少 viewport-fit');
  if (html.indexOf('icons/icon-192.png') === -1) throw new Error('缺少图标引用');
});

module.exports = { tests: tests };

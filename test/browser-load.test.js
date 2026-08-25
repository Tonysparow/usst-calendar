/* 上理日历 · 浏览器环境冒烟测试（vm 沙箱 + 最小 DOM 桩）
   验证：脚本按序加载、月历/今日条/侧栏/刻度尺渲染、选日、
   个人事项添加与本地存储。 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var assert = require('assert');

function makeEl() {
  var listeners = {};
  var classes = [];
  var innerHtml = '';
  var el;
  el = {
    id: '',
    className: '',
    textContent: '',
    value: '',
    title: '',
    href: '',
    target: '',
    rel: '',
    children: [],
    style: {},
    classList: {
      add: function (c) {
        if (classes.indexOf(c) === -1) {
          classes.push(c);
          el.className = classes.join(' ');
        }
      },
      remove: function (c) {
        classes = classes.filter(function (x) { return x !== c; });
        el.className = classes.join(' ');
      },
      contains: function (c) { return classes.indexOf(c) > -1; }
    },
    appendChild: function (child) { this.children.push(child); return child; },
    addEventListener: function (name, fn) { listeners[name] = fn; },
    dispatch: function (name) { if (listeners[name]) listeners[name]({ key: '' }); },
    setAttribute: function (k, v) { this[k] = v; },
    removeChild: function () {},
    parentNode: null,
    getBoundingClientRect: function () { return {}; }
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return innerHtml; },
    set: function (v) {
      innerHtml = v;
      el.children.length = 0;
    }
  });
  return el;
}

function buildSandbox(storage) {
  var els = {};
  var listeners = {};
  var created = [];
  var sandbox = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: function () { return 0; },
    clearInterval: function () {},
    Date: Date,
    Math: Math,
    JSON: JSON,
    Number: Number,
    String: String,
    Array: Array,
    Object: Object,
    navigator: {},
    Notification: { permission: 'default', requestPermission: function () { return Promise.resolve('denied'); } }
  };
  sandbox.fetch = function () { return Promise.reject(new Error('测试环境无网络')); };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.localStorage = storage;
  sandbox.document = {
    readyState: 'complete',
    createElement: function () {
      var e = makeEl();
      created.push(e);
      return e;
    },
    getElementById: function (id) {
      var found = created.filter(function (e) { return e.id === id; });
      if (found.length) return found[found.length - 1];
      if (!els[id]) els[id] = makeEl();
      return els[id];
    },
    addEventListener: function (name, fn) { listeners[name] = fn; }
  };
  sandbox.addEventListener = function (name, fn) { listeners[name] = fn; };
  vm.createContext(sandbox);
  sandbox.__els = els;
  sandbox.__listeners = listeners;
  sandbox.__created = created;
  return sandbox;
}

function loadAll(sandbox) {
  ['calendar-data', 'logic', 'app'].forEach(function (name) {
    var code = fs.readFileSync(path.join(ROOT, 'js', name + '.js'), 'utf-8');
    vm.runInContext(code, sandbox, { filename: name + '.js' });
  });
}

function storageMock() {
  var m = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); }
  };
}

var tests = [];

tests.push({
  name: '加载后渲染今日条、月历、侧栏与刻度尺',
  fn: function () {
    var storage = storageMock();
    var sandbox = buildSandbox(storage);
    loadAll(sandbox);
    var els = sandbox.__els;

    var title = els['cal-title'].textContent;
    assert.ok(/2026 年 \d+ 月/.test(title), '月历标题应含当前年月，实际：' + title);

    var gridChildren = els['cal-grid'].children;
    assert.ok(gridChildren.length >= 43, '月历应渲染 7 列 × 6 行网格，实际 ' + gridChildren.length + ' 个节点');

    var strip = els['today-strip'];
    assert.ok(strip.children.length > 0, '今日条应有内容');

    var dayPanel = els['panel-day'];
    assert.ok(dayPanel.children.length > 0, '当日面板应有内容');

    var scale = els['scale-rows'];
    assert.ok(scale.children.length >= 12, '刻度尺应覆盖 12 个月，实际 ' + scale.children.length + ' 行');

    var sources = els['source-list'];
    assert.ok(sources.children.length >= 6, '页脚应列出数据来源');
  }
});

tests.push({
  name: '点击日期单元格会切换当日面板',
  fn: function () {
    var sandbox = buildSandbox(storageMock());
    loadAll(sandbox);
    var els = sandbox.__els;
    var cell = els['cal-grid'].children[8]; // 第二周第一个单元格
    var before = els['panel-day'].innerHTML;
    cell.dispatch('click');
    assert.ok(els['panel-day'].children.length > 0, '点击后当日面板仍应有内容');
    assert.ok(els['cal-grid'].children.some(function (c) {
      return String(c.className).indexOf('selected') > -1;
    }), '点击后应有选中态单元格');
  }
});

tests.push({
  name: '添加个人事项写入 localStorage 并重渲染',
  fn: function () {
    var storage = storageMock();
    var sandbox = buildSandbox(storage);
    loadAll(sandbox);
    var els = sandbox.__els;

    var input = sandbox.__created.filter(function (e) { return e.id === 'personal-input'; });
    assert.ok(input.length > 0, '应渲染个人事项输入框');
    input[input.length - 1].value = '交实验报告';
    var addBtn = els['panel-day'].children[els['panel-day'].children.length - 1].children[1];
    addBtn.dispatch('click');

    var saved = JSON.parse(storage.getItem('usst-calendar-v1'));
    assert.ok(saved.personal, '应保存 personal 数据');
    var keys = Object.keys(saved.personal);
    assert.ok(keys.length === 1, '应恰好为一天添加事项');
    assert.strictEqual(saved.personal[keys[0]][0].title, '交实验报告', '事项标题正确');

    var cell25 = null;
    els['cal-grid'].children.forEach(function (c) {
      var num = c.children[0];
      if (num && String(num.className).indexOf('cell-num') > -1 && num.textContent === '25') cell25 = c;
    });
    assert.ok(cell25 && cell25.classList.contains('has-personal'), '25 号格子应有个人事项底色');
  }
});

tests.push({
  name: '格子内不渲染文字标签，多事件日加深、多类型日渐变',
  fn: function () {
    var sandbox = buildSandbox(storageMock());
    loadAll(sandbox);
    var els = sandbox.__els;

    function cells() { return els['cal-grid'].children; }
    function cellByDay(dayNum) {
      var found = null;
      cells().forEach(function (c) {
        var num = c.children[0];
        if (num && String(num.className).indexOf('cell-num') > -1 && num.textContent === String(dayNum)) {
          found = c;
        }
      });
      return found;
    }

    // 当前月（8 月）内不应有任何 cell-tag 文字标签
    var tagCount = 0;
    cells().forEach(function (c) {
      c.children.forEach(function (child) {
        if (String(child.className).indexOf('cell-tag') > -1) tagCount++;
      });
    });
    assert.strictEqual(tagCount, 0, '格子内不应有文字标签');

    // 切到下月（9 月）
    els['cal-next'].dispatch('click');

    var sep20 = cellByDay(20);
    assert.ok(sep20 && sep20.classList.contains('classday'), '9/20 仍是调休补课日');
    assert.ok(sep20 && sep20.classList.contains('has-many'), '9/20 有 4 件事应加深');

    var sep19 = cellByDay(19);
    assert.ok(sep19 && sep19.classList.contains('has-exam'), '9/19 应有考试底色');
    assert.ok(sep19 && sep19.classList.contains('has-activity'), '9/19 应有活动底色');
    assert.ok(sep19 && String(sep19.style.background).indexOf('linear-gradient') > -1, '9/19 多类型应叠加渐变');

    var sep25 = cellByDay(25);
    assert.ok(sep25 && sep25.classList.contains('holiday'), '9/25 中秋节仍保留红色放假底');
    assert.ok(sep25 && !sep25.classList.contains('has-many'), '9/25 仅 1 件事不应加深');
  }
});

tests.push({
  name: '自动抓取的事件会合并进日历并着色',
  fn: function () {
    var sandbox = buildSandbox(storageMock());
    sandbox.USST_LIVE_EVENTS = {
      checkedAt: '2026-08-25T08:00:00+08:00',
      events: [
        { id: 'live-test-1', date: '2026-08-26', title: '关于体测安排的通知', time: '全天', type: 'exam', org: '体育教学部', source: '体育部信息公告 · 自动抓取', url: 'http://tyb.usst.edu.cn/x', live: true },
        { id: 'live-test-2', date: '2026-09-05', title: '社团招新活动', time: '全天', type: 'activity', org: '学校', source: '官网通知公告 · 自动抓取', live: true }
      ]
    };
    loadAll(sandbox);
    var els = sandbox.__els;

    // 8/26 有自动抓取的体测事件 → 格子应有考试底色
    var cell26 = null;
    els['cal-grid'].children.forEach(function (c) {
      var num = c.children[0];
      if (num && String(num.className).indexOf('cell-num') > -1 && num.textContent === '26') cell26 = c;
    });
    assert.ok(cell26 && cell26.classList.contains('has-exam'), '自动抓取事件应让 8/26 格子有考试底色');

    // 未来事件列表应包含自动抓取的事件
    var upcomingText = '';
    els['upcoming-list'].children.forEach(function (li) {
      if (li.children[1]) upcomingText += li.children[1].textContent;
    });
    assert.ok(upcomingText.indexOf('体测安排') > -1, '接下来 5 件事应包含自动抓取的体测事件');
  }
});

tests.push({
  name: '远端模式：拉取云端 live-events.json 合并并更新状态',
  fn: function () {
    var storage = storageMock();
    var sandbox = buildSandbox(storage);
    // fetch 桩：本地 /api/* 不可达，云端 .json 可获取
    sandbox.fetch = function (url) {
      if (String(url).indexOf('/api/') > -1) return Promise.reject(new Error('no local server'));
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({
            ok: true,
            checkedAt: '2026-08-25T10:00:00+08:00',
            events: [
              { id: 'live-remote-1', date: '2026-08-27', title: '云端抓取的体测通知', time: '全天', type: 'exam', org: '体育教学部', source: '自动抓取', live: true }
            ]
          });
        }
      });
    };
    loadAll(sandbox);
    var els = sandbox.__els;

    return Promise.resolve()
      .then(function () { els['btn-sync'].dispatch('click'); })
      .then(function () { return new Promise(function (r) { setTimeout(r, 30); }); })
      .then(function () {
        var cell27 = null;
        els['cal-grid'].children.forEach(function (c) {
          var num = c.children[0];
          if (num && String(num.className).indexOf('cell-num') > -1 && num.textContent === '27') cell27 = c;
        });
        if (!cell27 || !cell27.classList.contains('has-exam')) {
          throw new Error('远端事件应合并进日历并带考试底色');
        }
        if (els['sync-status'].textContent.indexOf('已检查') === -1) {
          throw new Error('状态应显示已检查，实际：' + els['sync-status'].textContent);
        }
      });
  }
});

module.exports = { tests: tests };

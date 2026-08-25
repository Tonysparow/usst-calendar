/* ============================================================
   上理日历 · 应用层（渲染 + 交互 + 本地提醒）
   ============================================================ */
(function () {
  'use strict';

  var L = window.USST_CAL_LOGIC;
  var D = window.USST_CAL_DATA;
  var STORE_KEY = 'usst-calendar-v1';
  var LAST_CHECK_KEY = 'usst-calendar-lastcheck';
  var SYNC_BASE = 'http://127.0.0.1:3030';

  var WEEK_CN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  var TYPE_TEXT = { holiday: '放假', classday: '补课', exam: '考试', deadline: '截止', activity: '活动', notice: '通知' };
  var TYPE_CLASS = { holiday: 'holiday', classday: 'classday', exam: 'exam', deadline: 'deadline', activity: 'activity', notice: 'notice' };

  // 当天全部事件 = 官方事件 + 个人事项
  function dayItems(dateStr) {
    var official = L.eventsFor(dateStr);
    var personal = personalFor(dateStr).map(function (p) {
      return { id: p.id, title: p.title, time: null, type: 'personal', personal: true };
    });
    return official.concat(personal);
  }

  var state = {
    todayStr: L.fmtDate(new Date()),
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    selected: null,
    reminders: loadReminders()
  };

  // ---------- 本地存储 ----------

  function loadReminders() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var data = raw ? JSON.parse(raw) : {};
      return {
        events: data.events || {},
        personal: data.personal || {}
      };
    } catch (e) {
      return { events: {}, personal: {} };
    }
  }

  function saveReminders() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.reminders));
    } catch (e) { /* 存储失败不阻塞 */ }
  }

  function eventReminded(id) { return !!state.reminders.events[id]; }

  function personalFor(dateStr) { return state.reminders.personal[dateStr] || []; }

  function toggleEventRemind(id) {
    if (state.reminders.events[id]) {
      delete state.reminders.events[id];
      toast('已关闭提醒');
    } else {
      state.reminders.events[id] = true;
      toast('已开启提醒，当天打开页面会提示');
    }
    saveReminders();
    renderCalendar();
    renderDayPanel();
  }

  function addPersonal(dateStr) {
    var input = document.getElementById('personal-input');
    var text = input.value.trim();
    if (!text) return;
    var list = state.reminders.personal[dateStr] || (state.reminders.personal[dateStr] = []);
    list.push({ id: 'p' + Date.now(), title: text });
    input.value = '';
    saveReminders();
    renderDayPanel();
    renderCalendar();
    toast('已添加个人事项');
  }

  function removePersonal(dateStr, id) {
    var list = state.reminders.personal[dateStr] || [];
    state.reminders.personal[dateStr] = list.filter(function (p) { return p.id !== id; });
    if (!state.reminders.personal[dateStr].length) delete state.reminders.personal[dateStr];
    saveReminders();
    renderDayPanel();
    renderCalendar();
  }

  // ---------- 通知 ----------

  // ---------- 实时更新 ----------

  function mergeLiveEvents() {
    if (!window.USST_LIVE_EVENTS || !Array.isArray(window.USST_LIVE_EVENTS.events)) return 0;
    var known = {};
    D.events.forEach(function (e) { known[e.id] = true; });
    var added = 0;
    window.USST_LIVE_EVENTS.events.forEach(function (e) {
      if (e && e.id && !known[e.id] && e.date && e.title) {
        D.events.push(e);
        known[e.id] = true;
        added++;
      }
    });
    return added;
  }

  function setSyncStatus(text) {
    var el = document.getElementById('sync-status');
    if (el) el.textContent = text;
  }

  function prettyCheckedAt(iso) {
    if (!iso) return '未检查';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '未检查';
    var now = new Date();
    var sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    var hm = p(d.getHours()) + ':' + p(d.getMinutes());
    return sameDay ? '今日 ' + hm + ' 已检查' : '更新于 ' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm;
  }

  function fetchJson(url, timeoutMs) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 6000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) {
        if (timer) clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(function (e) {
        if (timer) clearTimeout(timer);
        throw e;
      });
  }

  function applyLivePayload(payload, silent) {
    if (!payload || !Array.isArray(payload.events)) return 0;
    window.USST_LIVE_EVENTS = payload;
    var added = mergeLiveEvents();
    if (added) {
      renderTodayStrip();
      renderCalendar();
      renderDayPanel();
      renderUpcoming();
      renderScale();
    }
    if (added && !silent) toast('实时更新：新增 ' + added + ' 条事件');
    return added;
  }

  function checkForUpdates(force) {
    var today = state.todayStr;
    var last = localStorage.getItem(LAST_CHECK_KEY);
    if (!force && last === today) {
      // 今天已检查过：只刷新状态显示
      fetchJson(SYNC_BASE + '/api/status', 1500).then(function (st) {
        if (st && st.ok) setSyncStatus(prettyCheckedAt(st.checkedAt));
      }).catch(function () {
        fetchJson('js/live-events.json?t=' + Date.now(), 1500).then(function (data) {
          setSyncStatus(prettyCheckedAt(data.checkedAt));
        }).catch(function () { setSyncStatus('更新服务未启动'); });
      });
      return;
    }
    setSyncStatus('检查中…');
    fetchJson(SYNC_BASE + '/api/update', 8000)
      .then(function (data) {
        if (!data.ok) throw new Error(data.error || '更新失败');
        localStorage.setItem(LAST_CHECK_KEY, today);
        setSyncStatus(prettyCheckedAt(data.checkedAt));
        handleUpdateResult(data, force);
      })
      .catch(function () {
        // 本地服务不可达 → 远端模式：拉取云端已生成的 live-events.json
        fetchJson('js/live-events.json?t=' + Date.now(), 8000)
          .then(function (data) {
            localStorage.setItem(LAST_CHECK_KEY, today);
            setSyncStatus(prettyCheckedAt(data.checkedAt));
            handleUpdateResult(data, force);
          })
          .catch(function () {
            setSyncStatus('更新服务未启动');
            if (force) toast('无法连接更新服务，请先运行 tools/launch.js（或确认网络）');
          });
      });
  }

  function handleUpdateResult(data, force) {
    var n = applyLivePayload(data);
    if (n && data.added && data.added.length) {
      toast('发现新事件：' + data.added.slice(0, 3).map(function (e) { return e.title; }).join('、') +
        (data.added.length > 3 ? ' 等 ' + data.added.length + ' 条' : ''));
    } else if (force) {
      toast('已检查更新，没有新事件');
    }
  }

  // 页面保持打开时每 30 分钟复查一次；仅当上次检查超过 30 分钟才真正抓取
  function periodicRecheck() {
    fetchJson(SYNC_BASE + '/api/status', 1500)
      .then(function (st) {
        if (!st || !st.ok || !st.checkedAt) return;
        var age = Date.now() - new Date(st.checkedAt).getTime();
        if (age > 30 * 60 * 1000) checkForUpdates(true);
      })
      .catch(function () {
        // 远端模式：静默拉取云端更新文件
        fetchJson('js/live-events.json?t=' + Date.now(), 1500)
          .then(function (data) {
            var n = applyLivePayload(data, true);
            setSyncStatus(prettyCheckedAt(data.checkedAt));
            if (n) toast('实时更新：新增 ' + n + ' 条事件');
          })
          .catch(function () { /* 离线时静默 */ });
      });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator &&
        (window.location.protocol === 'https:' ||
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 注册失败不影响使用 */ });
    }
  }

  function notifySupported() {
    return typeof Notification !== 'undefined' && Notification.permission !== 'denied';
  }

  function enableNotify() {
    if (!notifySupported()) {
      toast('当前浏览器不支持系统通知');
      return;
    }
    Notification.requestPermission().then(function (perm) {
      if (perm === 'granted') {
        toast('系统通知已开启');
        var btn = document.getElementById('btn-notify');
        btn.textContent = '提醒已开';
        btn.classList.add('on');
      } else {
        toast('未获得通知权限，仍在站内提醒');
      }
    });
  }

  function checkTodayReminders() {
    var items = [];
    D.events.forEach(function (e) {
      if (e.date === state.todayStr && eventReminded(e.id)) items.push(e.title);
    });
    personalFor(state.todayStr).forEach(function (p) { items.push(p.title); });
    if (!items.length) return;

    var text = '今天有 ' + items.length + ' 件事：' + items.slice(0, 3).join('、') + (items.length > 3 ? ' 等' : '');
    toast('📌 ' + text);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('上理日历 · 今日事宜', { body: text });
      } catch (e) { /* 忽略 */ }
    }
  }

  // ---------- 渲染 ----------

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderMeta() {
    var today = document.getElementById('meta-today');
    today.textContent = '今日 ' + state.todayStr + ' ' + WEEK_CN[L.weekdayIndex(state.todayStr)];
    var btn = document.getElementById('btn-notify');
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      btn.textContent = '提醒已开';
      btn.classList.add('on');
    }
  }

  function renderTodayStrip() {
    var wrap = document.getElementById('today-strip');
    wrap.innerHTML = '';

    var parts = state.todayStr.split('-');
    var dateBox = el('div', 'today-date');
    dateBox.appendChild(el('div', 'd-num', parts[1] + '/' + parts[2]));
    var sub = el('div', 'd-sub');
    sub.appendChild(el('span', null, parts[0] + '年 · ' + WEEK_CN[L.weekdayIndex(state.todayStr)]));
    if (L.isWeekend(state.todayStr)) sub.appendChild(el('span', 'chip', '周末'));
    dateBox.appendChild(sub);
    wrap.appendChild(dateBox);

    var body = el('div', 'today-body');

    var line1 = el('div', 'today-line');
    line1.appendChild(el('span', null, '学期进度'));
    var pct = L.progressPercent(state.todayStr);
    line1.appendChild(el('b', null, pct + '%'));
    var track = el('div', 'progress-track');
    var fill = el('div', 'progress-fill');
    fill.style.width = pct + '%';
    track.appendChild(fill);
    body.appendChild(line1);
    body.appendChild(track);

    var line2 = el('div', 'today-line');
    var todayEvents = dayItems(state.todayStr);
    line2.appendChild(el('span', null, '今日事宜'));
    var count = el('span', 'today-count', todayEvents.length + ' 项');
    line2.appendChild(count);
    var nextH = L.nextHolidayFrom(state.todayStr);
    if (nextH) {
      var days = L.daysBetween(state.todayStr, nextH.start);
      line2.appendChild(el('span', null, '距 ' + nextH.name + ' 还有 ' + days + ' 天'));
    }
    body.appendChild(line2);

    var chips = el('div', 'chips');
    todayEvents.slice(0, 5).forEach(function (e) {
      var c = el('span', 'chip dot', e.title);
      chips.appendChild(c);
    });
    if (!todayEvents.length) {
      chips.appendChild(el('span', 'chip empty', '今天没有安排，记得休息'));
    }
    body.appendChild(chips);
    wrap.appendChild(body);
  }

  function renderCalendar() {
    var title = document.getElementById('cal-title');
    title.textContent = state.year + ' 年 ' + (state.month + 1) + ' 月';

    var grid = document.getElementById('cal-grid');
    grid.innerHTML = '';
    WEEK_CN.forEach(function (w) { grid.appendChild(el('div', 'cal-dow', w)); });

    L.monthMatrix(state.year, state.month).forEach(function (week) {
      week.forEach(function (cell) {
        var node = el('div', 'cal-cell');
        if (!cell.inMonth) node.classList.add('out');
        if (L.isWeekend(cell.str)) node.classList.add('weekend');
        if (L.shouldMarkHoliday(cell.str)) node.classList.add('holiday');
        if (L.classDayFor(cell.str)) node.classList.add('classday');
        if (cell.str === state.todayStr) node.classList.add('today');
        if (cell.str === state.selected) node.classList.add('selected');

        node.appendChild(el('div', 'cell-num', String(cell.day)));

        var events = dayItems(cell.str);
        if (events.length) {
          if (events.length > 3) node.classList.add('has-many');
          var typeSet = [];
          events.forEach(function (e) {
            var t = e.personal ? 'personal' : (TYPE_CLASS[e.type] || 'notice');
            if (['exam', 'deadline', 'activity', 'notice', 'personal'].indexOf(t) > -1 && typeSet.indexOf(t) === -1) {
              typeSet.push(t);
            }
          });
          typeSet.forEach(function (t) { node.classList.add('has-' + t); });
          if (typeSet.length > 1 && !node.classList.contains('holiday') && !node.classList.contains('classday')) {
            var deep = node.classList.contains('has-many');
            var TINTS = {
              exam: deep ? '#83A892' : '#AECBB9',
              deadline: deep ? '#D9917F' : '#F2B8AC',
              activity: deep ? '#8198B6' : '#B3C3D9',
              notice: deep ? '#8198B6' : '#B3C3D9',
              personal: deep ? '#A694C8' : '#CEC3E2'
            };
            var stops = [];
            var step = 100 / typeSet.length;
            typeSet.forEach(function (t, i) {
              var c = TINTS[t];
              stops.push(c + ' ' + (i * step) + '%');
              stops.push(c + ' ' + ((i + 1) * step) + '%');
            });
            node.style.background = 'linear-gradient(135deg, ' + stops.join(', ') + ')';
          }
          var dots = el('div', 'cell-dots');
          events.forEach(function (e) {
            var dotCls = TYPE_CLASS[e.type] || (e.personal ? 'personal' : 'notice');
            var dot = el('span', 'cell-dot ' + dotCls);
            if (eventReminded(e.id)) dot.classList.add('reminded');
            dot.title = e.title;
            dots.appendChild(dot);
          });
          node.appendChild(dots);
        }

        node.addEventListener('click', function () {
          state.selected = cell.str;
          renderCalendar();
          renderDayPanel();
        });
        grid.appendChild(node);
      });
    });
  }

  function eventCard(e) {
    var card = el('div', 'event-card');
    var head = el('div', 'ev-head');
    head.appendChild(el('span', 'type-tag type-' + (TYPE_CLASS[e.type] || 'notice'), TYPE_TEXT[e.type] || e.type));
    head.appendChild(el('span', 'ev-title', e.title));
    if (e.time) head.appendChild(el('span', 'ev-time', e.time));
    card.appendChild(head);
    if (e.desc) card.appendChild(el('p', 'ev-desc', e.desc));
    var meta = el('div', 'ev-meta');
    meta.appendChild(el('span', null, e.org));
    meta.appendChild(el('span', null, '来源：' + e.source));
    if (e.url) {
      var link = el('a', 'ev-link', '原文 ↗');
      link.href = e.url;
      link.target = '_blank';
      link.rel = 'noopener';
      meta.appendChild(link);
    }
    card.appendChild(meta);

    var btn = el('button', 'btn btn-sm remind-btn', eventReminded(e.id) ? '✓ 已提醒' : '提醒我');
    if (eventReminded(e.id)) btn.classList.add('btn-seal');
    btn.addEventListener('click', function () { toggleEventRemind(e.id); });
    card.appendChild(btn);
    return card;
  }

  function renderDayPanel() {
    var panel = document.getElementById('panel-day');
    panel.innerHTML = '';
    var dateStr = state.selected || state.todayStr;
    var parts = dateStr.split('-');

    var head = el('div', 'day-head');
    head.appendChild(el('div', 'day-date', parts[1] + '月' + parts[2] + '日'));
    head.appendChild(el('span', 'day-week', parts[0] + ' · ' + WEEK_CN[L.weekdayIndex(dateStr)]));
    panel.appendChild(head);

    var badges = el('div', 'day-badges');
    var h = L.holidayFor(dateStr);
    if (L.shouldMarkHoliday(dateStr) && h) {
      badges.appendChild(el('span', 'badge holiday', h.name + '放假' + (L.isWeekend(dateStr) ? '（周末）' : '')));
    }
    if (L.isWeekend(dateStr) && !L.shouldMarkHoliday(dateStr) && !L.classDayFor(dateStr)) {
      badges.appendChild(el('span', 'badge weekend', '普通周末'));
    }
    var c = L.classDayFor(dateStr);
    if (c) badges.appendChild(el('span', 'badge classday', c.note));
    if (!badges.children.length) badges.appendChild(el('span', 'badge', '普通工作日'));
    panel.appendChild(badges);

    var events = L.eventsFor(dateStr);
    if (events.length) {
      var list = el('ul', 'event-list');
      events.forEach(function (e) {
        var li = el('li');
        li.appendChild(eventCard(e));
        list.appendChild(li);
      });
      panel.appendChild(list);
    } else {
      panel.appendChild(el('div', 'day-empty', '这天暂无官方安排。可在下方添加个人事项，自己提醒自己。'));
    }

    var personalTitle = el('h3', 'panel-title', '个人事项');
    panel.appendChild(personalTitle);

    var personalItems = personalFor(dateStr);
    if (personalItems.length) {
      personalItems.forEach(function (p) {
        var row = el('div', 'personal-item');
        row.appendChild(el('span', null, p.title));
        var del = el('button', null, '删除');
        del.addEventListener('click', function () { removePersonal(dateStr, p.id); });
        row.appendChild(del);
        panel.appendChild(row);
      });
    } else {
      panel.appendChild(el('div', 'day-empty', '暂无个人事项。'));
    }

    var form = el('div', 'personal-form');
    var input = el('input');
    input.id = 'personal-input';
    input.type = 'text';
    input.placeholder = '如：交实验报告';
    input.maxLength = 40;
    var add = el('button', 'btn btn-sm btn-ink', '添加');
    add.addEventListener('click', function () { addPersonal(dateStr); });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') addPersonal(dateStr);
    });
    form.appendChild(input);
    form.appendChild(add);
    panel.appendChild(form);
  }

  function renderUpcoming() {
    var list = document.getElementById('upcoming-list');
    list.innerHTML = '';
    var items = L.upcomingEvents(state.todayStr, 5);
    items.forEach(function (e) {
      var parts = e.date.split('-');
      var li = el('li', 'upcoming-item');
      var d = el('div', 'upcoming-date', parts[1] + '/' + parts[2]);
      d.appendChild(el('small', null, parts[0]));
      li.appendChild(d);
      var t = el('div', 'upcoming-title', e.title);
      if (e.time) t.appendChild(el('small', 'ev-time', ' ' + e.time));
      li.appendChild(t);
      li.addEventListener('click', function () {
        state.selected = e.date;
        var p = e.date.split('-');
        state.year = Number(p[0]);
        state.month = Number(p[1]) - 1;
        renderCalendar();
        renderDayPanel();
      });
      list.appendChild(li);
    });
  }

  function renderScale() {
    var rowsWrap = document.getElementById('scale-rows');
    rowsWrap.innerHTML = '';
    var scale = L.yearScale();
    var byMonth = {};
    scale.forEach(function (pip) {
      var key = pip.str.slice(0, 7);
      (byMonth[key] = byMonth[key] || []).push(pip);
    });

    Object.keys(byMonth).sort().forEach(function (key) {
      var row = el('div', 'scale-row');
      var monthLabel = key.replace('-', '.');
      var label = el('div', 'scale-month', monthLabel);
      row.appendChild(label);

      var pips = el('div', 'scale-pips');
      byMonth[key].forEach(function (pip) {
        var node = el('span', 'pip ' + pip.kind);
        var tipParts = [pip.str];
        if (pip.holiday) tipParts.push(pip.holiday + '放假');
        if (pip.classNote) tipParts.push(pip.classNote);
        if (pip.str === state.todayStr) { node.classList.add('today'); tipParts.push('今天'); }
        node.setAttribute('data-tip', tipParts.join(' · '));
        pips.appendChild(node);
      });
      row.appendChild(pips);
      rowsWrap.appendChild(row);
    });
  }

  function renderTerms() {
    var wrap = document.getElementById('term-blocks');
    wrap.innerHTML = '';
    [D.semester1, D.semester2].forEach(function (s) {
      var block = el('div', 'term-block');
      block.appendChild(el('h4', null, s.name + ' · ' + s.range));
      var ul = el('ul');
      [s.shortTerm, s.teaching, s.exams, s.winter || s.summer]
        .slice()
        .sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; })
        .forEach(function (seg) {
        var li = el('li');
        li.appendChild(el('span', 't-name', seg.name));
        li.appendChild(el('span', 't-dates', seg.start.replace('2026-', '').replace('2027-', '') + ' ～ ' + seg.end.replace('2026-', '').replace('2027-', '')));
        ul.appendChild(li);
      });
      block.appendChild(ul);
      wrap.appendChild(block);
    });
  }

  function renderSources() {
    var list = document.getElementById('source-list');
    D.sources.forEach(function (s) {
      var li = el('li');
      var a = el('a');
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.appendChild(el('span', 's-name', s.name));
      if (s.desc) a.appendChild(el('span', 's-desc', s.desc));
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  // ---------- Toast ----------

  function toast(msg) {
    var wrap = document.getElementById('toasts');
    var t = el('div', 'toast', msg);
    wrap.appendChild(t);
    setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 4200);
  }

  // ---------- 初始化 ----------

  function bindNav() {
    document.getElementById('cal-prev').addEventListener('click', function () {
      state.month -= 1;
      if (state.month < 0) { state.month = 11; state.year -= 1; }
      renderCalendar();
    });
    document.getElementById('cal-next').addEventListener('click', function () {
      state.month += 1;
      if (state.month > 11) { state.month = 0; state.year += 1; }
      renderCalendar();
    });
    document.getElementById('cal-jump').addEventListener('click', function () {
      var now = new Date();
      state.year = now.getFullYear();
      state.month = now.getMonth();
      state.selected = state.todayStr;
      renderCalendar();
      renderDayPanel();
    });
    document.getElementById('btn-notify').addEventListener('click', enableNotify);
    document.getElementById('btn-sync').addEventListener('click', function () { checkForUpdates(true); });
  }

  function init() {
    state.selected = state.todayStr;
    registerServiceWorker();
    var merged = mergeLiveEvents();
    if (merged) toast('已载入 ' + merged + ' 条自动更新事件');
    renderMeta();
    renderTodayStrip();
    renderCalendar();
    renderDayPanel();
    renderUpcoming();
    renderScale();
    renderTerms();
    renderSources();
    bindNav();
    setTimeout(function () { checkForUpdates(false); }, 900);
    setInterval(periodicRecheck, 30 * 60 * 1000);
    setTimeout(checkTodayReminders, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

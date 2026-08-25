/* ============================================================
   上理日历 · 纯逻辑（无 DOM 依赖，可单测）
   规则：放假区间内的每一天都标注，包括周六、周日。
   ============================================================ */
(function (global) {
  'use strict';

  var DATA = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./calendar-data.js')
    : global.USST_CAL_DATA;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function fmtDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // 解析 'YYYY-MM-DD'，按本地时区 00:00
  function parseDate(str) {
    var p = str.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  // 周一=0 … 周日=6
  function weekdayIndex(str) {
    var d = parseDate(str);
    return (d.getDay() + 6) % 7;
  }

  function isWeekend(str) {
    var w = weekdayIndex(str);
    return w === 5 || w === 6;
  }

  function inRange(str, start, end) {
    return str >= start && str <= end;
  }

  function addDays(str, n) {
    var d = parseDate(str);
    d.setDate(d.getDate() + n);
    return fmtDate(d);
  }

  function daysBetween(a, b) {
    var ms = parseDate(b).getTime() - parseDate(a).getTime();
    return Math.round(ms / 86400000);
  }

  function holidayFor(str) {
    var out = null;
    DATA.holidays.forEach(function (h) {
      if (inRange(str, h.start, h.end)) out = h;
    });
    return out;
  }

  // 该日是否按规则标注为放假（假期区间内均标注，含周末）
  function shouldMarkHoliday(str) {
    var h = holidayFor(str);
    return !!h;
  }

  function classDayFor(str) {
    var out = null;
    DATA.classDays.forEach(function (c) {
      if (c.date === str) out = c;
    });
    return out;
  }

  function eventsFor(str) {
    return DATA.events.filter(function (e) { return e.date === str; });
  }

  // 某月内所有“会标注”的放假日期（工作日）
  function markedHolidaysInMonth(year, month) {
    var res = [];
    var days = new Date(year, month + 1, 0).getDate();
    for (var i = 1; i <= days; i++) {
      var str = year + '-' + pad(month + 1) + '-' + pad(i);
      if (shouldMarkHoliday(str)) res.push(str);
    }
    return res;
  }

  // 从 fromStr 之后最近一个放假区间（按开始日）
  function nextHolidayFrom(str) {
    var best = null;
    DATA.holidays.forEach(function (h) {
      if (h.start > str && (!best || h.start < best.start)) best = h;
    });
    return best;
  }

  // 从 fromStr 起未来 limit 条事件
  function upcomingEvents(fromStr, limit) {
    return DATA.events
      .filter(function (e) { return e.date >= fromStr; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; })
      .slice(0, limit || 10);
  }

  // 月历矩阵：6 行 × 7 列（周一开头），返回 { str, day, inMonth }
  function monthMatrix(year, month) {
    var first = new Date(year, month, 1);
    var mondayOffset = (first.getDay() + 6) % 7;
    var gridStart = new Date(year, month, 1 - mondayOffset);
    var weeks = [];
    for (var w = 0; w < 6; w++) {
      var week = [];
      for (var d = 0; d < 7; d++) {
        var dt = new Date(gridStart.getTime());
        dt.setDate(gridStart.getDate() + w * 7 + d);
        week.push({
          str: fmtDate(dt),
          day: dt.getDate(),
          inMonth: dt.getMonth() === month
        });
      }
      weeks.push(week);
    }
    return weeks;
  }

  function semesterFor(str) {
    if (inRange(str, DATA.semester1.shortTerm.start, DATA.semester1.winter.end)) {
      return DATA.semester1;
    }
    if (inRange(str, DATA.semester2.teaching.start, DATA.semester2.summer.end)) {
      return DATA.semester2;
    }
    return null;
  }

  // 第一学期教学周序号（9月7日为第1周），假期区间返回 -1
  function weekOfSemester1(str) {
    if (str < DATA.semester1.shortTerm.start || str > DATA.semester1.winter.end) return null;
    return Math.floor(daysBetween(DATA.semester1.shortTerm.start, str) / 7) + 1;
  }

  function progressPercent(str) {
    var pct = Math.round((daysBetween(DATA.yearStart, str) / daysBetween(DATA.yearStart, DATA.yearEnd)) * 100);
    return Math.max(0, Math.min(100, pct));
  }

  // 学年刻度：yearStart..yearEnd 每一天的标注类型
  // holiday=放假（工作日）、classday=调休补课、weekend=周末（不标假）、plain=普通工作日
  function yearScale() {
    var res = [];
    var cur = DATA.yearStart;
    var guard = 0;
    while (cur <= DATA.yearEnd && guard < 400) {
      var kind = 'plain';
      if (shouldMarkHoliday(cur)) kind = 'holiday';
      else if (classDayFor(cur)) kind = 'classday';
      else if (isWeekend(cur)) kind = 'weekend';
      var h = holidayFor(cur);
      res.push({
        str: cur,
        kind: kind,
        holiday: h ? h.name : null,
        classNote: classDayFor(cur) ? classDayFor(cur).note : null
      });
      cur = addDays(cur, 1);
      guard++;
    }
    return res;
  }

  var API = {
    pad: pad,
    fmtDate: fmtDate,
    parseDate: parseDate,
    weekdayIndex: weekdayIndex,
    isWeekend: isWeekend,
    inRange: inRange,
    addDays: addDays,
    daysBetween: daysBetween,
    holidayFor: holidayFor,
    shouldMarkHoliday: shouldMarkHoliday,
    classDayFor: classDayFor,
    eventsFor: eventsFor,
    markedHolidaysInMonth: markedHolidaysInMonth,
    nextHolidayFrom: nextHolidayFrom,
    upcomingEvents: upcomingEvents,
    monthMatrix: monthMatrix,
    semesterFor: semesterFor,
    weekOfSemester1: weekOfSemester1,
    progressPercent: progressPercent,
    yearScale: yearScale
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.USST_CAL_LOGIC = API;
  }
})(typeof window !== 'undefined' ? window : globalThis);

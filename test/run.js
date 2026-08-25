/* 上理日历 · 逻辑测试
   node test/run.js
   覆盖：周末判定、放假标注规则（周末重合不标注）、调休补课、
   月历矩阵、学期周次、事件查询、学年刻度。 */
'use strict';

var path = require('path');
var L = require(path.join(__dirname, '..', 'js', 'logic.js'));
var D = require(path.join(__dirname, '..', 'js', 'calendar-data.js'));

var passed = 0;
var failed = 0;

function ok(cond, name) {
  if (cond) {
    passed++;
    console.log('  ✓ ' + name);
  } else {
    failed++;
    console.error('  ✗ ' + name);
  }
}

function eq(actual, expected, name) {
  ok(JSON.stringify(actual) === JSON.stringify(expected), name + '（期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual) + '）');
}

function run() {
console.log('—— 周末判定 ——');
ok(L.isWeekend('2026-09-26'), '2026-09-26（周六）是周末');
ok(L.isWeekend('2026-09-27'), '2026-09-27（周日）是周末');
ok(!L.isWeekend('2026-09-25'), '2026-09-25（周五）不是周末');

console.log('—— 放假标注规则：假期区间含周末也标注 ——');
ok(L.shouldMarkHoliday('2026-09-25'), '中秋节 9/25（周五）标注');
ok(L.shouldMarkHoliday('2026-09-26'), '中秋节 9/26（周六）也标注');
ok(L.shouldMarkHoliday('2026-09-27'), '中秋节 9/27（周日）也标注');
ok(L.shouldMarkHoliday('2026-10-01'), '国庆 10/1（周四）标注');
ok(L.shouldMarkHoliday('2026-10-05'), '国庆 10/5（周一）标注');
ok(L.shouldMarkHoliday('2026-10-03'), '国庆 10/3（周六）也标注');
ok(L.shouldMarkHoliday('2026-10-04'), '国庆 10/4（周日）也标注');
ok(L.shouldMarkHoliday('2027-01-25'), '寒假开始 1/25（周一）标注');
ok(L.shouldMarkHoliday('2027-02-15'), '寒假 2/15（周一）标注');
ok(L.shouldMarkHoliday('2027-02-06'), '寒假内春节 2/6（周六）也标注');
ok(L.shouldMarkHoliday('2027-04-05'), '清明 4/5（周一）标注');
ok(L.shouldMarkHoliday('2027-05-01'), '劳动节 5/1（周六）也标注');
ok(L.shouldMarkHoliday('2027-06-09'), '端午 6/9（周三）标注');
ok(L.shouldMarkHoliday('2027-07-12'), '暑假开始 7/12（周一）标注');
ok(L.shouldMarkHoliday('2027-07-18'), '暑假内 7/18（周日）也标注');
ok(!L.shouldMarkHoliday('2026-10-11'), '普通周日 10/11（不在假期）不标注');

console.log('—— 调休补课 ——');
eq(L.classDayFor('2026-09-20') && L.classDayFor('2026-09-20').note, '国庆调休 · 补课', '9/20 补课');
ok(!!L.classDayFor('2026-10-10'), '10/10 补课');
ok(!L.classDayFor('2026-09-21'), '9/21 非补课日');

console.log('—— 月内标注天数 ——');
eq(L.markedHolidaysInMonth(2026, 8), ['2026-09-25', '2026-09-26', '2026-09-27'], '2026年9月：中秋三天全部标注');
eq(L.markedHolidaysInMonth(2026, 9), ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'], '2026年10月：国庆七天全部标注');
eq(L.markedHolidaysInMonth(2027, 0), ['2027-01-01', '2027-01-25', '2027-01-26', '2027-01-27', '2027-01-28', '2027-01-29', '2027-01-30', '2027-01-31'], '2027年1月：元旦+寒假（含周末）标注');

console.log('—— 下一次放假 ——');
eq(L.nextHolidayFrom('2026-08-25').start, '2026-09-25', '8/25 后最近放假为中秋节');
eq(L.nextHolidayFrom('2026-10-08').start, '2027-01-01', '国庆后最近放假为元旦');

console.log('—— 事件查询 ——');
ok(L.eventsFor('2026-10-31').some(function (e) { return e.title.indexOf('120周年') > -1; }), '10/31 校庆事件存在');
ok(L.eventsFor('2026-12-12').some(function (e) { return e.title.indexOf('四、六级笔试') > -1; }), '12/12 四六级笔试存在');
ok(L.eventsFor('2026-09-20').some(function (e) { return e.title.indexOf('英语分级') > -1; }), '9/20 新生英语分级考试存在');
ok(L.upcomingEvents('2026-08-25', 5).length >= 5, '未来事件至少 5 条');

console.log('—— 月历矩阵 ——');
var sep = L.monthMatrix(2026, 8);
eq(sep.length, 6, '2026年9月渲染 6 行');
eq(sep[0][0].str, '2026-08-31', '9月首格为 8/31（周一，上月）');
eq(sep[0][0].inMonth, false, '8/31 不在本月');
eq(sep[0][6].str, '2026-09-06', '首周周日为 9/6');

console.log('—— 学期周次 ——');
eq(L.weekOfSemester1('2026-09-07'), 1, '9/7 为第 1 周');
eq(L.weekOfSemester1('2026-09-21'), 3, '9/21 为第 3 周');
eq(L.weekOfSemester1('2027-01-25'), 21, '1/25 为第 21 周（寒假开始）');
eq(L.semesterFor('2026-10-10').name, '第一学期', '10/10 属第一学期');
eq(L.semesterFor('2027-03-01').name, '第二学期', '3/1 属第二学期');

console.log('—— 学年刻度 ——');
var scale = L.yearScale();
var holidayPips = scale.filter(function (p) { return p.kind === 'holiday'; });
var weekendPips = scale.filter(function (p) { return p.kind === 'weekend'; });
ok(holidayPips.length > 0 && weekendPips.length > 0, '刻度包含放假与周末色块');
ok(scale.length >= 360, '刻度覆盖整个学年（' + scale.length + ' 天）');
ok(scale.every(function (p) {
  if (p.kind === 'holiday') return L.holidayFor(p.str) !== null;
  if (L.holidayFor(p.str)) return p.kind === 'holiday';
  return true;
}), '假期内每一天（含周末）都是红色放假色块');
ok(scale.every(function (p) {
  if (p.kind === 'weekend') return !L.holidayFor(p.str);
  return true;
}), '普通周末才用深灰色块');

console.log('—— 数据完整性 ——');
ok(D.holidays.length === 8, '8 个官方假期区间');
ok(D.events.length >= 30, '官方事件不少于 30 条（实际 ' + D.events.length + '）');
ok(D.sources.length >= 6, '数据来源不少于 6 个');
D.events.forEach(function (e) {
  ok(/^\d{4}-\d{2}-\d{2}$/.test(e.date) && !isNaN(new Date(e.date).getTime()), '事件日期合法：' + e.id);
});

console.log('');
console.log('结果：' + passed + ' 通过，' + failed + ' 失败');
return failed;
}

module.exports = { run: run };

if (require.main === module) {
  process.exit(run() ? 1 : 0);
}

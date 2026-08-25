/* 上理日历 · 官方来源解析测试（离线） */
'use strict';

var P = require('../tools/parse-sources.js');

var tests = [];

function t(name, fn) { tests.push({ name: name, fn: fn }); }
function eq(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error((msg || '') + ' 期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual));
  }
}

t('列表页解析：链接在前、日期在后', function () {
  var html =
    '<li><a href="/2026/1016/c2967a348618/page.htm" title="体测通知">关于2026年体测安排的通知</a><div class="news_date">2026-10-16</div></li>' +
    '<li><a href="/2026/0824/c10239a358999/page.htm">四六级成绩查询通知</a><span>2026-08-24</span></li>';
  var items = P.parseList(html, 'http://tyb.usst.edu.cn');
  eq(items.length, 2, '应解析出 2 条');
  eq(items[0].title, '关于2026年体测安排的通知', '标题正确');
  eq(items[0].date, '2026-10-16', '日期正确');
  eq(items[0].url, 'http://tyb.usst.edu.cn/2026/1016/c2967a348618/page.htm', '相对链接解析正确');
});

t('列表页解析：日期在前、链接在后', function () {
  var html = '<li><div class="d">2026-09-01</div><a href="/x/page.htm">迎新活动通知</a></li>';
  var items = P.parseList(html, 'http://jwc.usst.edu.cn');
  eq(items.length, 1, '应解析出 1 条');
  eq(items[0].title, '迎新活动通知', '标题正确');
  eq(items[0].date, '2026-09-01', '日期正确');
});

t('正文日期提取：完整日期与月日并存', function () {
  var text = '体育教学部将于10月20日（大三）、10月25日（大四）起测试，2026年10月20日—11月5日进行。';
  var dates = P.extractDatesFromText(text, '2026-10-16');
  eq(dates, ['2026-10-20', '2026-10-25', '2026-11-05'], '应提取全部日期');
});

t('正文日期提取：跨年月份修正', function () {
  var dates = P.extractDatesFromText('寒假2月6日开学，2月20日截止。', '2026-11-20');
  eq(dates, ['2027-02-06', '2027-02-20'], '11 月通知提到 2 月应视为次年');
});

t('关键词分类', function () {
  eq(P.classify('关于开展体测的通知'), 'exam', '体测→考试');
  eq(P.classify('选课报名截止提醒'), 'deadline', '报名→截止');
  eq(P.classify('校庆晚会活动安排'), 'activity', '校庆→活动');
  eq(P.classify('元旦放假通知'), 'notice', '放假→通知');
});

t('相关性过滤', function () {
  eq(P.isRelevant('关于体测安排的通知'), true, '体测相关');
  eq(P.isRelevant('图书馆空调采购中标公告'), false, '采购无关');
});

t('事件 id 稳定', function () {
  var a = P.eventId('2026-10-20', '体测安排通知', '体育部信息公告');
  var b = P.eventId('2026-10-20', '体测安排通知', '体育部信息公告');
  eq(a, b, '同一事件两次生成 id 相同');
  eq(a.length > 10, true, 'id 非空');
});

t('robots.txt 解析与路径判定', function () {
  var robots = [
    'User-agent: *',
    'Disallow: /2026/',
    'Disallow: /private*'
  ].join('\n');
  var rules = P.parseRobots(robots);
  eq(rules, ['/2026/', '/private*'], '应提取全部 Disallow 规则');
  eq(P.isPathDisallowed(rules, '/2026/1016/page.htm'), true, '前缀匹配被禁止');
  eq(P.isPathDisallowed(rules, '/2967/list.htm'), false, '未匹配路径允许');
  eq(P.isPathDisallowed(rules, '/private-x'), true, '通配符规则生效');
  eq(P.isPathDisallowed([], '/2026/x'), false, '无规则允许');
  eq(P.isPathDisallowed(['/'], '/anything'), true, '根路径规则禁止全站');
});

module.exports = { tests: tests };

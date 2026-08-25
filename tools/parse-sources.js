/* ============================================================
   上理日历 · 官方来源解析（纯函数，可单测）
   用于从官网列表页 / 文章正文中提取通知标题、日期与链接。
   ============================================================ */
'use strict';

function decodeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveUrl(href, base) {
  if (!href) return null;
  try {
    return new URL(href, base).href;
  } catch (e) {
    return href;
  }
}

// 从列表页 HTML 提取 { title, date, url }，兼容“链接在前日期在后”和“日期在前链接在后”
function parseList(html, baseUrl) {
  if (!html) return [];
  var cleaned = String(html).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  var items = [];
  var seen = {};

  var patA = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>([\s\S]{0,600}?)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/gi;
  var m;
  while ((m = patA.exec(cleaned)) !== null) {
    var title = decodeHtml(m[2]);
    if (!title) continue;
    title = title.trim();
    if (title.length < 4 || title.length > 50) continue;
    if (/^(首页|更多|导航|友情链接|联系我们|部门概况|当前位置|上理首页)/.test(title)) continue;
    var date = m[4] + '-' + pad2(m[5]) + '-' + pad2(m[6]);
    var url = resolveUrl(m[1], baseUrl);
    if (!seen[url || title]) {
      seen[url || title] = true;
      items.push({ title: title, date: date, url: url });
    }
  }

  var patB = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[\s\S]{0,400}?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = patB.exec(cleaned)) !== null) {
    var titleB = decodeHtml(m[5]);
    if (!titleB) continue;
    titleB = titleB.trim();
    if (titleB.length < 4 || titleB.length > 50) continue;
    if (/^(首页|更多|导航|友情链接|联系我们|部门概况|当前位置|上理首页)/.test(titleB)) continue;
    var dateB = m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
    var urlB = resolveUrl(m[4], baseUrl);
    if (!seen[urlB || titleB]) {
      seen[urlB || titleB] = true;
      items.push({ title: titleB, date: dateB, url: urlB });
    }
  }

  return items;
}

function pad2(n) {
  var num = Number(n);
  return num < 10 ? '0' + num : '' + num;
}

// 从文章正文提取日期：'2026年10月20日'、'2026-10-20'、'10月25日'
function extractDatesFromText(text, publishDateStr) {
  var out = [];
  var seen = {};
  var publishYear = publishDateStr ? Number(publishDateStr.slice(0, 4)) : new Date().getFullYear();
  var full = /(\d{4})[年\/\-.](\d{1,2})[月\/\-.](\d{1,2})[日号]?/g;
  var m;
  while ((m = full.exec(text)) !== null) {
    var d = m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
    if (!seen[d]) { seen[d] = true; out.push(d); }
  }
  var short = /(\d{1,2})月(\d{1,2})[日号]/g;
  while ((m = short.exec(text)) !== null) {
    var month = Number(m[1]);
    var day = Number(m[2]);
    var year = publishYear;
    if (publishDateStr) {
      var pubMonth = Number(publishDateStr.slice(5, 7));
      // 通知通常面向未来：月份比发布月份早 3 个月以上视为次年
      if (month < pubMonth - 3) year += 1;
    }
    var d2 = year + '-' + pad2(month) + '-' + pad2(day);
    if (!seen[d2]) { seen[d2] = true; out.push(d2); }
  }
  return out.sort();
}

// 按标题关键词推断事件类型
function classify(title) {
  var t = String(title || '');
  if (/(报名|选课|申报|确认|截止|缴费|填报|预选|提醒|抢票)/.test(t)) return 'deadline';
  if (/(体测|体质|测试|考试|补考|笔试|口试|测评|考核)/.test(t)) return 'exam';
  if (/(校庆|活动|讲座|竞赛|比赛|大会|迎新|开放|展览|双选|招聘|宣讲|晚会|文化节|运动会|联赛|纪念)/.test(t)) return 'activity';
  if (/(放假|假期|调休|注册|报到|开学|停课|补课|通知|停电|维护|封闭)/.test(t)) return 'notice';
  return 'notice';
}

// 事件是否与校园相关（关键词白名单）
function isRelevant(title) {
  var t = String(title || '');
  return /(体测|体质|测试|考试|补考|笔试|口试|报名|选课|申报|确认|截止|缴费|校庆|活动|讲座|竞赛|比赛|迎新|开学|注册|报到|放假|假期|调休|补课|停课|双选|招聘|宣讲|文化节|运动会|联赛|奖学金|证书|毕业|实习|答辩|测评|考核|开放|演出|展览|志愿|支教|参军|征兵)/.test(t);
}

// 生成稳定的 id
function eventId(date, title, sourceName) {
  var base = (date + '-' + title + '-' + sourceName)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .slice(0, 80);
  return 'live-' + base;
}

// robots.txt：仅提取 Disallow 规则（不区分 User-agent 分组，保守适用）
function parseRobots(text) {
  var rules = [];
  var lines = String(text || '').split(/\r?\n/);
  lines.forEach(function (line) {
    var m = line.match(/^\s*disallow\s*:\s*(\S*)\s*$/i);
    if (m) rules.push(m[1]);
  });
  return rules;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isPathDisallowed(rules, path) {
  if (!rules || !rules.length || !path) return false;
  return rules.some(function (rule) {
    if (!rule || rule === '') return false; // 空 Disallow 表示允许
    if (rule.indexOf('*') === -1) {
      return path.indexOf(rule) === 0;
    }
    var re = new RegExp('^' + rule.split('*').map(escapeRe).join('.*'));
    return re.test(path);
  });
}

module.exports = {
  decodeHtml: decodeHtml,
  resolveUrl: resolveUrl,
  parseList: parseList,
  extractDatesFromText: extractDatesFromText,
  classify: classify,
  isRelevant: isRelevant,
  eventId: eventId,
  parseRobots: parseRobots,
  isPathDisallowed: isPathDisallowed
};

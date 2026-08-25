/* ============================================================
   上理日历 · 每日事件更新器
   抓取上海理工大学官网 / 教务处 / 体育教学部通知列表，
   并尽力检索微信公众号「上海理工大学体育教学部」，
   把新事件写入 js/live-events.js 与 js/live-events.json，
   日历打开时自动合并展示。

   用法：
     node tools/update-events.js                  # 检查全部来源
     node tools/update-events.js --url <链接>     # 导入一篇公众号/官网文章
     node tools/update-events.js --once           # 只跑一次，不写文件（调试）
   ============================================================ */
'use strict';

var fs = require('fs');
var path = require('path');
var P = require('./parse-sources.js');

var ROOT = path.join(__dirname, '..');
var LIVE_JS = path.join(ROOT, 'js', 'live-events.js');
var LIVE_JSON = path.join(ROOT, 'js', 'live-events.json');

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

var SOURCES = [
  {
    name: '体育部信息公告',
    org: '体育教学部',
    base: 'http://tyb.usst.edu.cn',
    list: 'http://tyb.usst.edu.cn/2967/list.htm'
  },
  {
    name: '教务处教学运行管理',
    org: '教务处',
    base: 'http://jwc.usst.edu.cn',
    list: 'http://jwc.usst.edu.cn/10239/list.htm'
  },
  {
    name: '官网通知公告',
    org: '学校办公室',
    base: 'http://xxgk.usst.edu.cn',
    list: 'http://xxgk.usst.edu.cn/8492/list1.psp'
  }
];

var WINDOW_START = '2026-08-01';
var WINDOW_END = '2027-09-30';
var NEGATIVE_RE = /(招标|采购|中标|比选|磋商|国家科技重大专项|申报指南|监理|测绘|竣工验收|维保|物业|翻新|改造工程)/;

function log() {
  var args = Array.prototype.slice.call(arguments);
  console.log.apply(console, ['[' + new Date().toLocaleString('zh-CN') + ']'].concat(args));
}

function fetchText(url, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs || 15000);
    fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' },
      signal: ctrl.signal
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
        return r.text();
      })
      .then(function (text) { clearTimeout(timer); resolve(text); })
      .catch(function (e) { clearTimeout(timer); reject(e); });
  });
}

function inWindow(dateStr) {
  return dateStr >= WINDOW_START && dateStr <= WINDOW_END;
}

function loadExisting() {
  var live = { checkedAt: null, events: [] };
  try {
    var raw = fs.readFileSync(LIVE_JSON, 'utf-8');
    live = JSON.parse(raw);
  } catch (e) { /* 首次运行无文件 */ }
  var official = [];
  try {
    official = require(path.join(ROOT, 'js', 'calendar-data.js')).events || [];
  } catch (e) { /* 忽略 */ }
  return { live: live, official: official };
}

function knownKeys(live, official) {
  var keys = {};
  [].concat(live.events || [], official || []).forEach(function (e) {
    keys[(e.title || '') + '|' + (e.date || '')] = true;
    keys[e.id] = true;
  });
  return keys;
}

function normTitle(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, '')
    .replace(/^关于/, '')
    .replace(/的通知$/, '');
}

function buildTitleMap(live, official) {
  var map = {};
  [].concat(live.events || [], official || []).forEach(function (e) {
    if (!e.date) return;
    (map[e.date] = map[e.date] || []).push(e.title || '');
  });
  return map;
}

function isDuplicate(title, date, titleMap) {
  var n = normTitle(title);
  if (!n || !titleMap[date]) return !n;
  return titleMap[date].some(function (x) {
    var nx = normTitle(x);
    if (!nx) return false;
    if (nx === n) return true;
    if (n.length >= 6 && (nx.indexOf(n) > -1 || n.indexOf(nx) > -1)) return true;
    // 同日期 + 相同主题词 → 视为重复（如“四六级成绩查询”的多种表述）
    var fragments = ['四六级', '四、六级', '成绩', '体测', '体质', '选课', '补考', '注册', '报到', '校庆', '放假', '寒假', '暑假', '国庆', '中秋', '毕业', '实习', '考试'];
    return fragments.some(function (f) { return nx.indexOf(f) > -1 && n.indexOf(f) > -1; });
  });
}

function pickDate(text, publishDate) {
  var dates = P.extractDatesFromText(text, publishDate).filter(inWindow);
  return dates.length ? dates[0] : (inWindow(publishDate) ? publishDate : null);
}

function stripBody(html) {
  var text = P.decodeHtml(html);
  // 去掉常见页脚噪音
  return text.replace(/(版权所有|地址：|邮编：|邮箱：|电话：|沪ICP备|友情链接|返回顶部)[\s\S]*$/i, ' ').slice(0, 400).trim();
}

function getDesc(html, title) {
  var meta = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i);
  var desc = meta ? P.decodeHtml(meta[1]) : '';
  if (desc.length < 10) {
    var text = P.decodeHtml(html);
    var idx = title ? text.indexOf(title) : -1;
    desc = (idx > -1 ? text.slice(idx + title.length) : text);
    desc = desc.replace(/(版权所有|地址：|邮编：|邮箱：|电话：|沪ICP备|友情链接|返回顶部|搜索\s*菜单)[\s\S]*$/i, ' ');
  }
  return desc.replace(/\s+/g, ' ').trim().slice(0, 120);
}

async function fetchArticle(item, source) {
  if (!item.url) return null;
  try {
    var html = await fetchText(item.url);
    var text = stripBody(html);
    var title = item.title;
    var og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (og && og[1]) title = P.decodeHtml(og[1]);
    var date = pickDate(text, item.date);
    var desc = getDesc(html, title);
    return { date: date, title: title, desc: desc };
  } catch (e) {
    return { date: item.date, title: item.title, desc: '' };
  }
}

var robotsCache = {};

async function robotsAllowed(source) {
  var origin = new URL(source.base).origin;
  if (robotsCache[origin] !== undefined) return robotsCache[origin];
  var allowed = true;
  try {
    var robots = await fetchText(origin + '/robots.txt', 8000);
    var rules = P.parseRobots(robots);
    var listPath = new URL(source.list).pathname;
    allowed = !P.isPathDisallowed(rules, listPath);
    if (!allowed) {
      log('跳过 ' + source.name + '：robots.txt 禁止抓取 ' + listPath);
    }
  } catch (e) {
    // 没有 robots.txt 视为允许
  }
  robotsCache[origin] = allowed;
  return allowed;
}

async function checkSource(source) {
  var added = [];
  var errors = [];
  try {
    if (!(await robotsAllowed(source))) {
      return { added: added, errors: errors };
    }
    var html = await fetchText(source.list);
    var items = P.parseList(html, source.base)
      .filter(function (it) {
        return P.isRelevant(it.title) && inWindow(it.date) && !NEGATIVE_RE.test(it.title);
      })
      .slice(0, 8);
    for (var i = 0; i < items.length; i++) {
      var art = await fetchArticle(items[i], source);
      if (!art || !art.date || !inWindow(art.date)) continue;
      added.push({
        id: P.eventId(art.date, art.title, source.name),
        date: art.date,
        title: art.title,
        time: '全天',
        type: P.classify(art.title),
        org: source.org,
        source: source.name + ' · 自动抓取',
        url: items[i].url,
        desc: art.desc || '详情见来源链接。',
        live: true
      });
    }
  } catch (e) {
    errors.push(source.name + '：' + e.message);
  }
  return { added: added, errors: errors };
}

async function checkWeChat() {
  // 微信没有公开搜索接口：先尝试搜狗微信搜索（可能被验证码拦截），
  // 失败时在结果中给出提示，用户可以手动粘贴公众号文章链接用 --url 导入。
  var errors = [];
  var added = [];
  try {
    var q = encodeURIComponent('上海理工大学体育教学部 体测');
    var html = await fetchText('https://weixin.sogou.com/weixin?type=2&query=' + q, 12000);
    var items = P.parseList(html, 'https://weixin.sogou.com')
      .filter(function (it) { return P.isRelevant(it.title); })
      .slice(0, 5);
    items.forEach(function (it) {
      var date = P.extractDatesFromText(it.title + ' ' + html.slice(html.indexOf(it.title), html.indexOf(it.title) + 500), null)
        .filter(inWindow)[0] || null;
      if (!date) return;
      added.push({
        id: P.eventId(date, it.title, '微信公众号'),
        date: date,
        title: it.title,
        time: '全天',
        type: P.classify(it.title),
        org: '上海理工大学体育教学部',
        source: '微信公众号（搜狗搜索） · 自动抓取',
        url: it.url,
        desc: '来自公众号文章，请以原文为准。',
        live: true
      });
    });
  } catch (e) {
    errors.push('微信公众号搜索：' + e.message + '（可手动用 --url 导入公众号文章链接）');
  }
  return { added: added, errors: errors };
}

async function importArticle(url) {
  var html = await fetchText(url);
  var title = P.decodeHtml((html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '导入文章');
  var pubMatch = html.match(/(\d{4})-(\d{2})-(\d{2})/);
  var pubDate = pubMatch ? pubMatch[1] + '-' + pubMatch[2] + '-' + pubMatch[3] : null;
  var date = pickDate(stripBody(html), pubDate) || pubDate;
  return [{
    id: P.eventId(date || 'unknown', title, '公众号导入'),
    date: date,
    title: title,
    time: '全天',
    type: P.classify(title),
    org: '上海理工大学体育教学部',
    source: '公众号文章导入',
    url: url,
    desc: getDesc(html, title),
    live: true
  }];
}

async function runUpdate(opts) {
  opts = opts || {};
  var existing = loadExisting();
  var keys = knownKeys(existing.live, existing.official);
  var titleMap = buildTitleMap(existing.live, existing.official);
  var allAdded = [];
  var allErrors = [];

  if (opts.importUrl) {
    try {
      allAdded = await importArticle(opts.importUrl);
    } catch (e) {
      allErrors.push('文章导入失败：' + e.message);
    }
  } else {
    for (var i = 0; i < SOURCES.length; i++) {
      var r = await checkSource(SOURCES[i]);
      allAdded = allAdded.concat(r.added);
      allErrors = allErrors.concat(r.errors);
    }
    var wx = await checkWeChat();
    allAdded = allAdded.concat(wx.added);
    allErrors = allErrors.concat(wx.errors);
  }

  // 去重（对本次运行内部也去重）
  var fresh = [];
  var localKeys = {};
  allAdded.forEach(function (e) {
    var k = e.title + '|' + e.date;
    if (!keys[k] && !localKeys[k] && e.date && !NEGATIVE_RE.test(e.title) && !isDuplicate(e.title, e.date, titleMap)) {
      keys[k] = true;
      localKeys[k] = true;
      titleMap[e.date] = (titleMap[e.date] || []).concat(e.title);
      fresh.push(e);
    }
  });
  fresh = fresh.slice(0, 10);

  var checkedAt = new Date().toISOString();
  var payload = {
    checkedAt: checkedAt,
    events: (existing.live.events || []).concat(fresh)
  };

  if (!opts.once) {
    fs.writeFileSync(LIVE_JSON, JSON.stringify(payload, null, 2), 'utf-8');
    fs.writeFileSync(LIVE_JS,
      '/* 由 tools/update-events.js 自动生成，请勿手改 */\nwindow.USST_LIVE_EVENTS = ' +
      JSON.stringify(payload, null, 2) + ';\n', 'utf-8');
  }

  return {
    checkedAt: checkedAt,
    added: fresh,
    total: payload.events.length,
    errors: allErrors
  };
}

// 直接运行时执行
if (require.main === module) {
  var args = process.argv.slice(2);
  var urlArg = null;
  var once = false;
  args.forEach(function (a) {
    if (a === '--once') once = true;
    else if (a === '--url') { /* 下一参数 */ }
    else if (!urlArg && /^https?:\/\//.test(a)) urlArg = a;
  });
  var urlIdx = args.indexOf('--url');
  if (urlIdx > -1 && args[urlIdx + 1]) urlArg = args[urlIdx + 1];

  runUpdate({ importUrl: urlArg, once: once })
    .then(function (res) {
      log('检查完成：新增 ' + res.added.length + ' 条，累计 ' + res.total + ' 条');
      res.added.forEach(function (e) { log('  + ' + e.date + ' ' + e.title + '（' + e.org + '）'); });
      res.errors.forEach(function (er) { log('  ! ' + er); });
      process.exit(0);
    })
    .catch(function (e) {
      log('更新失败：' + (e && e.message ? e.message : e));
      process.exit(1);
    });
}

module.exports = { runUpdate: runUpdate, SOURCES: SOURCES, loadExisting: loadExisting };

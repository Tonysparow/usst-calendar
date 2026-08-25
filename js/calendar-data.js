/* ============================================================
   上理日历 · 内置数据（2026-2027 学年）
   数据来源：上海理工大学官网（教务处、研究生院、招生办、校办、
   管理学院）公开通知、学校 2026-2027 学年校历、国务院办公厅
   2026 年部分节假日安排、教育部教育考试院考试安排。
   放假/活动日期以学校最新通知为准，2027 年节假日安排以国务院
   办公厅届时发布的通知为准。
   ============================================================ */
(function (global) {
  'use strict';

  var YEAR_START = '2026-09-01'; // 学年刻度起点
  var YEAR_END = '2027-08-31';   // 学年刻度终点

  var SEMESTER1 = {
    name: '第一学期',
    range: '2026-09-07 ～ 2027-02-21',
    shortTerm: { name: '短学期（学术科研周）', start: '2026-09-07', end: '2026-09-20' },
    teaching: { name: '理论教学周', start: '2026-09-21', end: '2027-01-10' },
    exams: { name: '考试周', start: '2027-01-11', end: '2027-01-24' },
    winter: { name: '寒假', start: '2027-01-25', end: '2027-02-21' }
  };

  var SEMESTER2 = {
    name: '第二学期',
    range: '2027-02-22 ～ 2027-08-29',
    shortTerm: { name: '短学期', start: '2027-06-28', end: '2027-07-11' },
    teaching: { name: '理论教学周', start: '2027-02-22', end: '2027-06-13' },
    exams: { name: '考试周', start: '2027-06-14', end: '2027-06-27' },
    summer: { name: '暑假', start: '2027-07-12', end: '2027-08-29' }
  };

  // 官方放假区间。展示时假期区间内的每一天都标注，包括周六、周日。
  var HOLIDAYS = [
    { id: 'mid-autumn', name: '中秋节', start: '2026-09-25', end: '2026-09-27', source: '国务院办公厅2026年放假安排 / 校历' },
    { id: 'national', name: '国庆节', start: '2026-10-01', end: '2026-10-07', source: '国务院办公厅2026年放假安排 / 校历' },
    { id: 'newyear', name: '元旦', start: '2027-01-01', end: '2027-01-01', source: '2026-2027学年校历（元旦假期安排以国务院办公厅通知为准）' },
    { id: 'winter', name: '寒假', start: '2027-01-25', end: '2027-02-21', source: '2026-2027学年校历（教务处）' },
    { id: 'qingming', name: '清明节', start: '2027-04-05', end: '2027-04-05', source: '2026-2027学年校历' },
    { id: 'labor', name: '劳动节', start: '2027-05-01', end: '2027-05-01', weekend: true, source: '2026-2027学年校历（2027-05-01为周六，假期内周末也标注）' },
    { id: 'dragonboat', name: '端午节', start: '2027-06-09', end: '2027-06-09', source: '2026-2027学年校历' },
    { id: 'summer', name: '暑假', start: '2027-07-12', end: '2027-08-29', source: '2026-2027学年校历' }
  ];

  // 调休补课日（国务院办公厅2026年放假安排）
  var CLASS_DAYS = [
    { date: '2026-09-20', note: '国庆调休 · 补课' },
    { date: '2026-10-10', note: '国庆调休 · 补课' }
  ];

  // 校园日历事件（整理自官网公开通知与官方公众号）
  var EVENTS = [
    // ---------- 2026 年 8 月 ----------
    { id: 'e001', date: '2026-08-24', title: '2026上半年四六级成绩查询开通', time: '6:00 起', type: 'exam', org: '教育部教育考试院', source: '中国教育考试网', desc: '凭准考证号和姓名查询。' },
    { id: 'e002', date: '2026-08-25', title: '暑假 · 在校服务按假期安排运行', time: '全天', type: 'notice', org: '学校办公室', source: '校官网通知', desc: '假期后勤、图书馆开放时间以学校通知为准。' },
    { id: 'e003', date: '2026-08-31', title: '四六级电子成绩报告单下载开通', time: '9:00 起', type: 'exam', org: '教育部教育考试院', source: '中国教育考试网', desc: '电子报告单与纸质版同等效力。' },

    // ---------- 2026 年 9 月 ----------
    { id: 'e004', date: '2026-09-07', title: '短学期（学术科研周）开始', time: '全天', type: 'notice', org: '教务处 · 研究生院', source: '2026-2027学年校历', desc: '第1—2周为短学期，各学院按安排开展学术科研周活动。' },
    { id: 'e005', date: '2026-09-14', title: '研究生第二轮选课开始', time: '9:00 起', type: 'deadline', org: '研究生院', source: '研究生综合服务平台', desc: '制定个人培养计划并完成新学期课程初选，9月14日—9月18日。' },
    { id: 'e006', date: '2026-09-19', title: '开学补考开始', time: '全天', type: 'exam', org: '教务处', source: '教务通知（以教务处安排为准）', desc: '开学补考预计在理论教学开始前后进行，具体以教务处通知为准。' },
    { id: 'e007', date: '2026-09-19', title: '插班生、专升本新生报到', time: '13:00-16:00', type: 'activity', org: '招生办公室', source: '招办通知 zhaoban.usst.edu.cn', desc: '地点：学生发展中心一楼多功能厅（军工路580号），凭身份证与预录取通知书办理。' },
    { id: 'e008', date: '2026-09-20', title: '2026级新生英语分级考试', time: '9:00-10:30', type: 'exam', org: '教务处 · 外语学院', source: '教务通知 jwc.usst.edu.cn', desc: '2026级本科新生闭卷考试，考场以教务系统查询为准。' },
    { id: 'e009', date: '2026-09-20', title: '国庆调休 · 补课', time: '全天', type: 'classday', org: '学校办公室', source: '国务院办公厅2026年放假安排', desc: '9月20日（周日）上班，学校按教学安排补课。' },
    { id: 'e010', date: '2026-09-20', title: '全日制本科生注册开始', time: '全天', type: 'notice', org: '教务处', source: '教务通知 jwc.usst.edu.cn', desc: '在读本科生注册时间 9月20日—9月22日；新生入学报到即视为完成注册。' },
    { id: 'e011', date: '2026-09-21', title: '理论教学周开始', time: '全天', type: 'notice', org: '教务处 · 研究生院', source: '2026-2027学年校历', desc: '本学期理论教学正式开课。' },
    { id: 'e012', date: '2026-09-25', title: '中秋节假期开始', time: '全天', type: 'holiday', org: '学校办公室', source: '国务院办公厅2026年放假安排', desc: '9月25日（周五）—27日（周日）放假，共3天，不调休。' },
    { id: 'e013', date: '2026-09-20', title: '2026级本科新生报到季', time: '9月中旬（以录取通知书为准）', type: 'notice', org: '招生办公室', source: '录取通知书 / 迎新系统', desc: '2026级本科新生报到具体日期见录取通知书；报到即视为完成注册。' },

    // ---------- 2026 年 10 月 ----------
    { id: 'e014', date: '2026-10-01', title: '国庆节假期开始', time: '全天', type: 'holiday', org: '学校办公室', source: '国务院办公厅2026年放假安排', desc: '10月1日—7日放假调休，共7天；10月10日（周六）上班补课。' },
    { id: 'e015', date: '2026-10-09', title: '2027考研预报名（预计）', time: '10月上旬', type: 'deadline', org: '研招网 yz.chsi.com.cn', source: '研招网（以2027年招生简章为准）', desc: '预计10月上旬开始预报名，具体以中国研究生招生信息网公告为准。' },
    { id: 'e016', date: '2026-10-10', title: '国庆调休 · 补课', time: '全天', type: 'classday', org: '学校办公室', source: '国务院办公厅2026年放假安排', desc: '10月10日（周六）上班，学校按教学安排补课。' },
    { id: 'e017', date: '2026-10-15', title: '2027考研正式报名（预计）', time: '10月中旬起', type: 'deadline', org: '研招网 yz.chsi.com.cn', source: '研招网（以2027年招生简章为准）', desc: '预计10月中旬至月底正式报名，具体以研招网公告为准。' },
    { id: 'e018', date: '2026-10-31', title: '建校120周年校庆日', time: '全天', type: 'activity', org: '上海理工大学', source: '校庆通知 bs.usst.edu.cn', desc: '2026年为建校120周年（1906—2026），校庆日为每年10月最后一周的周六，今年为10月31日；校庆系列活动以学校通知为准。' },

    // ---------- 2026 年 11 月 ----------
    { id: 'e019', date: '2026-11-21', title: '大学英语四级口语考试（CET-SET4）', time: '全天', type: 'exam', org: '教育部教育考试院', source: '中国教育考试网', desc: '机考，具体场次以准考证为准。' },
    { id: 'e020', date: '2026-11-22', title: '大学英语六级口语考试（CET-SET6）', time: '全天', type: 'exam', org: '教育部教育考试院', source: '中国教育考试网', desc: '机考，具体场次以准考证为准。' },

    // ---------- 2026 年 12 月 ----------
    { id: 'e021', date: '2026-12-12', title: '大学英语四、六级笔试', time: '上午四级 / 下午六级', type: 'exam', org: '教育部教育考试院', source: '中国教育考试网', desc: '考场与时间以准考证为准。' },
    { id: 'e022', date: '2026-12-19', title: '2027考研初试（预计）', time: '12月19-20日', type: 'exam', org: '研招网 yz.chsi.com.cn', source: '研招网（以官方公告为准）', desc: '全国硕士研究生招生考试初试预计在12月倒数第二个周末举行，以教育部公告为准。' },

    // ---------- 2027 年 1 月 ----------
    { id: 'e023', date: '2027-01-01', title: '元旦', time: '全天', type: 'holiday', org: '学校办公室', source: '2026-2027学年校历', desc: '元旦假期安排以国务院办公厅通知为准。' },
    { id: 'e024', date: '2027-01-11', title: '期末考试周开始', time: '全天', type: 'exam', org: '教务处', source: '2026-2027学年校历', desc: '第19—20周（1月11日—1月24日）为考试周，具体安排以教务系统为准。' },
    { id: 'e025', date: '2027-01-25', title: '寒假开始', time: '全天', type: 'holiday', org: '学校办公室', source: '2026-2027学年校历', desc: '第21周起进入寒假，合理安排离校与复习。' },
    { id: 'e026', date: '2027-02-06', title: '春节（农历正月初一）', time: '全天', type: 'notice', org: '学校办公室', source: '校历（正值寒假，假期内周末一并标注）', desc: '2月6日（周六）为春节，处于寒假假期内，按放假一并标注。' },

    // ---------- 2027 年 4 月 ----------
    { id: 'e027', date: '2027-04-05', title: '清明节', time: '全天', type: 'holiday', org: '学校办公室', source: '2026-2027学年校历', desc: '4月5日（周一）清明节，放假安排以国务院办公厅通知为准。' },

    // ---------- 2027 年 5 月 ----------
    { id: 'e028', date: '2027-05-01', title: '劳动节（周六，不另标注）', time: '全天', type: 'notice', org: '学校办公室', source: '2026-2027学年校历', desc: '5月1日（周六）劳动节，与周末重合，按规则不另作放假标注。' },

    // ---------- 2027 年 6 月 ----------
    { id: 'e029', date: '2027-06-09', title: '端午节', time: '全天', type: 'holiday', org: '学校办公室', source: '2026-2027学年校历', desc: '6月9日（周三）端午节。' },
    { id: 'e030', date: '2027-06-14', title: '期末考试周开始', time: '全天', type: 'exam', org: '教务处', source: '2026-2027学年校历', desc: '第17—18周（6月14日—6月27日）为考试周。' },

    // ---------- 2027 年 7 月 ----------
    { id: 'e031', date: '2027-07-12', title: '暑假开始', time: '全天', type: 'holiday', org: '学校办公室', source: '2026-2027学年校历', desc: '第21周起放暑假。' }
  ];

  // 官方渠道（供页脚展示）
  var SOURCES = [
    { name: '上海理工大学官网', url: 'https://www.usst.edu.cn', desc: '学校要闻、通知公告' },
    { name: '教务处 · 2026-2027学年校历', url: 'https://jwc.usst.edu.cn/2026/0603/c10386a363057/page.htm', desc: '学期周次、假期区间' },
    { name: '教务处 · 注册通知', url: 'http://jwc.usst.edu.cn/2026/0716/c10239a368806/page.htm', desc: '9月20—22日注册' },
    { name: '教务处 · 新生英语分级考试通知', url: 'http://jwc.usst.edu.cn/2026/0805/c10239a369320/page.htm', desc: '9月20日考试' },
    { name: '招生办 · 插班生/专升本报到须知', url: 'http://zhaoban.usst.edu.cn/2026/0810/c6166a369429/page.htm', desc: '9月19日报到' },
    { name: '管理学院 · 百廿校庆校友返校邀请函', url: 'https://bs.usst.edu.cn/2026/0401/c10581a358994/page.htm', desc: '校庆日10月31日' },
    { name: '国务院办公厅2026年部分节假日安排', url: 'https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html', desc: '中秋、国庆、调休' },
    { name: '官方公众号「上海理工大学」及各部门公众号', url: 'https://www.usst.edu.cn', desc: '活动与通知渠道' }
  ];

  var DATA = {
    academicYear: '2026—2027学年',
    yearStart: YEAR_START,
    yearEnd: YEAR_END,
    semester1: SEMESTER1,
    semester2: SEMESTER2,
    holidays: HOLIDAYS,
    classDays: CLASS_DAYS,
    events: EVENTS,
    sources: SOURCES
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DATA;
  } else {
    global.USST_CAL_DATA = DATA;
  }
})(typeof window !== 'undefined' ? window : globalThis);

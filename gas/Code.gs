/**
 * 質因數分解互動學習網｜Google Apps Script 後端
 * ------------------------------------------------------------
 * 一個後端同時服務兩種前端：
 *   1. GitHub Pages 版：學生網頁用 fetch POST 到本程式的網址（doPost）
 *   2. Google 協作平台版：本程式直接提供網頁（doGet → Index.html），
 *      學生網頁用 google.script.run 呼叫 recordFromClient()
 * 教師戰情室：
 *   - GitHub Pages 版：網址加 ?teacher=1，資料用 GET ?api=data&key=密碼 取得
 *   - 協作平台版：本程式網址加 ?teacher=1（直接開，不要嵌在協作平台裡）
 *
 * 教師密碼只存在這個檔案（伺服器端），學生在網頁原始碼裡看不到。
 */

// ★★★ 請改成你自己的教師密碼（不要用預設值，否則戰情室會拒絕登入）★★★
const TEACHER_KEY = 'change-me';

const SUMMARY_SHEET = '學生總覽';
const EVENT_SHEET = '作答紀錄';
const SUMMARY_HEADERS = ['識別碼', '班級', '座號', '姓名', '進入方式', '閱讀秒數', '微檢核通過', '工作台完成',
  '作答題數', '有效答對', '正確率', '盲猜次數', '平均秒數', '精熟', '最後更新', '完整資料JSON'];
const EVENT_HEADERS = ['伺服器時間', '識別碼', '班級', '座號', '姓名', '事件', '內容JSON'];

/** 第一次使用：在試算表的 Apps Script 編輯器中選這個函式按「執行」一次 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('請從 Google 試算表的「擴充功能 → Apps Script」開啟這個專案再執行 setup');
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  getSheet_(SUMMARY_SHEET, SUMMARY_HEADERS);
  getSheet_(EVENT_SHEET, EVENT_HEADERS);
  Logger.log('完成！試算表：' + ss.getUrl());
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.api === 'data') return json_(getClassData(p.key));
  if (p.api === 'ping') return json_({ ok: true });
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('質因數分解互動學習網')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    return json_(recordFromClient(payload));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** 學生端送來的資料：snapshot（目前學習狀態總覽）＋ events（新事件） */
function recordFromClient(payload) {
  const s = payload && payload.snapshot;
  if (!s || !s.name || !s.classId || !s.seatNo) return { ok: false, error: '缺少班級、座號或姓名' };

  const cls = clean_(s.classId, 10);
  const seat = clean_(s.seatNo, 4);
  const name = clean_(s.name, 20);
  const key = cls + '-' + seat;
  const q = s.quiz || {};
  const now = new Date();

  const row = [
    key, cls, seat, name,
    clean_(s.entryLabel || '', 20),
    num_(s.readSec),
    num_(s.cpCount) + '/3',
    num_(s.workbench),
    num_(q.attempts),
    num_(q.validCorrect),
    q.attempts ? Math.round(num_(q.correct) / num_(q.attempts) * 100) + '%' : '',
    num_(q.rapid),
    num_(q.avgSec),
    s.mastered ? '是' : '',
    now,
    JSON.stringify(s).slice(0, 45000)
  ];

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_(SUMMARY_SHEET, SUMMARY_HEADERS);
    const last = sh.getLastRow();
    let rowIndex = -1;
    if (last > 1) {
      const keys = sh.getRange(2, 1, last - 1, 1).getDisplayValues();
      for (let i = 0; i < keys.length; i++) {
        if (keys[i][0] === key) { rowIndex = i + 2; break; }
      }
    }
    if (rowIndex > 0) sh.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    else sh.getRange(last + 1, 1, 1, row.length).setValues([row]);

    const events = Array.isArray(payload.events) ? payload.events.slice(0, 50) : [];
    if (events.length) {
      const esh = getSheet_(EVENT_SHEET, EVENT_HEADERS);
      const rows = events.map(ev => [now, key, cls, seat, name, clean_(ev && ev.type, 20), JSON.stringify(ev).slice(0, 5000)]);
      esh.getRange(esh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
    return { ok: true, at: now.toISOString() };
  } finally {
    lock.releaseLock();
  }
}

/** 教師戰情室讀取全班資料（密碼在伺服器端比對） */
function getClassData(key) {
  if (TEACHER_KEY === 'change-me') return { ok: false, error: '請先在 Code.gs 第 16 行把 TEACHER_KEY 改成你自己的密碼，並重新部署' };
  if (String(key || '') !== TEACHER_KEY) return { ok: false, error: '教師密碼錯誤' };
  const sh = getSheet_(SUMMARY_SHEET, SUMMARY_HEADERS);
  const last = sh.getLastRow();
  const students = [];
  if (last > 1) {
    const values = sh.getRange(2, 1, last - 1, SUMMARY_HEADERS.length).getValues();
    values.forEach(r => {
      let data = {};
      try { data = JSON.parse(r[15]); } catch (e) {}
      const updated = r[14] instanceof Date ? r[14].toISOString() : String(r[14]);
      students.push({ key: String(r[0]), classId: String(r[1]), seatNo: String(r[2]), name: String(r[3]), updatedAt: updated, data: data });
    });
  }
  return { ok: true, serverTime: new Date().toISOString(), students: students };
}

/* ---------- 工具函式 ---------- */
function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}
function getSheet_(name, headers) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange('A:E').setNumberFormat('@');   // 識別碼、班級、座號以文字儲存，避免 05 變成 5
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function clean_(v, max) {
  let s = String(v == null ? '' : v).trim().slice(0, max || 50);
  if (/^[=+\-@]/.test(s)) s = "'" + s;   // 防止試算表公式注入
  return s;
}
function num_(v) { const n = Number(v); return isFinite(n) ? n : 0; }
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

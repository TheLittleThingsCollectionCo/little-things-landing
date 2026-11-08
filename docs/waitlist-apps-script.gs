// Bound to a dedicated private Sheet. No external POST collector or read API.
var HEADERS_ = ['timestamp', 'email', 'source', 'page', 'request_id', 'consent'];
var CONSENT_ = 'launch-notification-v1';
var PAGE_ = 'https://thelittlethingscollection.com/';

function doGet() {
  var template = HtmlService.createTemplateFromFile('Waitlist');
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put('form:' + token, String(Date.now()), 1800);
  template.token = token;
  // Keep DEFAULT frame protection. The website links here; it does not embed.
  return template.evaluate().setTitle('The Little Things Collection — Early access')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Run from editor before deployment; never callable through google.script.run.
function setup_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open Apps Script from the dedicated Sheet.');
  var sheet = ss.getSheetByName('Waitlist') || ss.insertSheet('Waitlist');
  if (!sheet.getLastRow()) sheet.appendRow(HEADERS_);
  assertHeaders_(sheet);
  sheet.setFrozenRows(1);
  sheet.getRange('A:F').setNumberFormat('@');
  sheet.autoResizeColumns(1, HEADERS_.length);
  PropertiesService.getScriptProperties().setProperties({SPREADSHEET_ID: ss.getId(), ENABLED: 'false'});
}

// Public RPC: no emails or existing-list membership returned to callers.
function submitWaitlist(data) {
  try { return collect_(data); }
  catch (err) {
    // Do not log payloads, addresses, spreadsheet IDs, or exception details.
    throw new Error('Receipt could not be confirmed. Please retry.');
  }
}

function collect_(data) {
  var properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('ENABLED') !== 'true') throw new Error('Disabled');
  if (!data || typeof data !== 'object') throw new Error('Invalid request');
  var email = String(data.email || '').trim();
  var id = String(data.requestId || '');
  var token = String(data.token || '');
  if (!isPlausibleEmail_(email) || !/^[a-f0-9-]{36}$/i.test(id) ||
      !/^[a-f0-9-]{36}$/i.test(token) || data.website || data.consent !== true) {
    throw new Error('Invalid request');
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Busy');
  try {
    var cache = CacheService.getScriptCache();
    var issued = Number(cache.get('form:' + token));
    if (!issued || Date.now() - issued < 1500 || Date.now() - issued > 1800000) {
      throw new Error('Expired form');
    }
    // Bound-script active-document helpers are unreliable in web app execution.
    var sheet = SpreadsheetApp.openById(properties.getProperty('SPREADSHEET_ID')).getSheetByName('Waitlist');
    if (!sheet) throw new Error('Missing sheet');
    assertHeaders_(sheet);
    var last = sheet.getLastRow();
    var rows = last > 1 ? sheet.getRange(2, 1, last - 1, 6).getDisplayValues() : [];
    // Retry after an ambiguous failure must not append the same request twice.
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][4] === id) {
        if (rows[i][1] !== email) throw new Error('Request conflict');
        return {ok: true, requestId: id};
      }
    }
    // Global daily cap protects sheet growth, not Apps Script execution quotas.
    var day = new Date().toISOString().slice(0, 10);
    var today = rows.filter(function(row) { return row[0].slice(0, 10) === day; }).length;
    if (today >= 200 || last >= 10001) throw new Error('Capacity');
    var recent = rows.some(function(row) {
      return row[1].toLowerCase() === email.toLowerCase() &&
        Date.now() - Date.parse(row[0]) < 60000;
    });
    if (recent) throw new Error('Please wait');
    var expected = [new Date().toISOString(), email, 'landing', PAGE_, id, CONSENT_];
    if (last + 1 > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 1000);
    var range = sheet.getRange(last + 1, 1, 1, 6);
    range.setNumberFormat('@');
    // Prefix externally controlled text to prevent formulas and CSV injection.
    range.setValues([expected.map(function(value) { return "'" + value; })]);
    SpreadsheetApp.flush();
    var actual = range.getDisplayValues()[0];
    if (actual.some(function(value, index) { return value !== expected[index]; })) {
      throw new Error('Readback mismatch');
    }
    return {ok: true, requestId: id};
  } finally { lock.releaseLock(); }
}

function assertHeaders_(sheet) {
  var headers = sheet.getRange(1, 1, 1, 6).getDisplayValues()[0];
  if (headers.join('|') !== HEADERS_.join('|')) throw new Error('Header mismatch');
}

function isPlausibleEmail_(email) {
  return email.length <= 254 && /^[^\s@\x00-\x1f\x7f]+@[^\s@\x00-\x1f\x7f]+\.[^\s@\x00-\x1f\x7f]+$/.test(email);
}

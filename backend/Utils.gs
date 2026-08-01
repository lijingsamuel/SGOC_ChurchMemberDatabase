/**
 * Utils.gs
 * Shared helpers: spreadsheet access, JSON responses, tokens, audit log, ids.
 *
 * IMPORTANT: This script must be bound to (or configured with) the Google Sheet
 * that acts as the database. Set the Spreadsheet ID in Script Properties as
 * SPREADSHEET_ID, or run this as a container-bound script (attached to the sheet).
 */

var SHEET_VOLUNTEERS = 'Volunteers';
var SHEET_FAMILIES = 'Families';
var SHEET_MEMBERS = 'Members';
var SHEET_AUDIT = 'AuditLog';
var SHEET_CONFIG = 'Config';

// NOTE: legacy columns (Ward, Area, HouseName, Landmark, PinCode, Email, District,
// State, Country, MapLink) are kept here for backward compatibility with sheets
// that already have this column layout — the current wizard no longer collects
// them, but removing them would shift every column after and corrupt existing
// rows. PrayerGroup is appended at the end, which is safe to add without shifting
// anything (requires a matching "PrayerGroup" header cell in the live sheet).
var FAMILY_HEADERS = [
  'FamilyID', 'HouseNumber', 'FamilyName', 'HeadOfFamily', 'Ward', 'Area',
  'HouseName', 'Address', 'Landmark', 'PinCode', 'Phone', 'WhatsApp', 'Email',
  'Remarks', 'District', 'State', 'Country', 'MapLink', 'Volunteer', 'Status',
  'CreatedDate', 'UpdatedDate', 'PrayerGroup'
];

var MEMBER_HEADERS = [
  'FamilyID', 'MemberID', 'MemberName', 'Gender', 'Relation', 'DOB', 'Age',
  'WeddingDate', 'BloodGroup', 'Phone', 'WhatsApp', 'Email', 'Occupation',
  'Education', 'BaptismName', 'MaritalStatus', 'Notes', 'SortOrder'
];

var VOLUNTEER_HEADERS = ['Name', 'PIN', 'Mobile', 'Role', 'Status'];

var AUDIT_HEADERS = ['Timestamp', 'Volunteer', 'Action', 'FamilyID', 'Device'];

function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    return SpreadsheetApp.openById(id);
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('No spreadsheet configured. Set SPREADSHEET_ID in Script Properties.');
}

function getSheet_(name) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function jsonOk_(result) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, result: result }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError_(message, code) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: String(message), code: code || 'ERROR' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Reads a full sheet into an array of plain objects keyed by header row. */
function sheetToObjects_(sheetName) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.join('') === '') continue; // skip fully blank rows
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    obj.__row = r + 1; // 1-based sheet row number, for updates/deletes
    rows.push(obj);
  }
  return rows;
}

/**
 * Forces a column to Plain Text format ('@') so a purely-numeric ID (e.g.
 * "1023") is stored as the literal typed string instead of Sheets silently
 * reinterpreting it as a Number on write. This matters because FamilyID
 * lookups elsewhere use strict (===) string comparison — a Number and a
 * String that look identical in the sheet UI never match under ===, which
 * breaks the Families<->Members FamilyID link for numeric-looking IDs.
 * Must be called BEFORE writing the value for it to take effect; changing
 * format alone does not retroactively convert an already-stored Number back
 * into text.
 */
function forceTextColumn_(sheet, colIndex) {
  var rows = Math.max(sheet.getMaxRows(), 1);
  sheet.getRange(1, colIndex, rows, 1).setNumberFormat('@');
}

function objectToRow_(obj, headers) {
  return headers.map(function (h) {
    return obj[h] === undefined || obj[h] === null ? '' : obj[h];
  });
}

/** Formats a Date/date-string to yyyy-MM-dd, or '' if empty. */
function formatDate_(value) {
  if (!value) return '';
  var d = (value instanceof Date) ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd');
}

function nowStamp_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss');
}

function computeAge_(dobStr) {
  if (!dobStr) return '';
  var dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return '';
  var today = new Date();
  var age = today.getFullYear() - dob.getFullYear();
  var m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : '';
}

function logAudit_(volunteer, action, familyId, device) {
  try {
    var sheet = getSheet_(SHEET_AUDIT);
    sheet.appendRow([nowStamp_(), volunteer || '', action || '', familyId || '', device || '']);
  } catch (e) {
    // Audit logging must never break the main flow.
  }
}

/** Basic HTML/script sanitation for free-text fields stored in the sheet. */
function sanitizeText_(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

/**
 * Only sanitizes keys the caller actually sent. A key that's absent (because
 * the current wizard no longer collects it) is left OUT of the result rather
 * than defaulted to '' — callers use that to fall back to the existing sheet
 * value instead of blanking it out. An explicitly empty string still comes
 * through as ''.
 */
function sanitizeFamily_(f) {
  var clean = {};
  FAMILY_HEADERS.forEach(function (h) {
    if (!(h in f)) return;
    if (h === 'FamilyID') {
      // Always a literal string, even if a numeric-looking ID round-tripped
      // through the client as a JS Number — writing an actual Number value
      // later would ignore the sheet's Plain Text column format and get
      // reinterpreted, breaking the Families<->Members FamilyID link.
      clean[h] = (f[h] === undefined || f[h] === null || f[h] === '') ? '' : String(f[h]);
    } else if (h === 'Status' || h === 'CreatedDate' || h === 'UpdatedDate' || h === 'Volunteer') {
      clean[h] = f[h] || '';
    } else {
      clean[h] = sanitizeText_(f[h]);
    }
  });
  return clean;
}

function sanitizeMember_(m) {
  var clean = {};
  MEMBER_HEADERS.forEach(function (h) {
    if (!(h in m)) return;
    if (h === 'Age' || h === 'SortOrder') {
      clean[h] = m[h] || 0;
    } else {
      clean[h] = sanitizeText_(m[h]);
    }
  });
  return clean;
}

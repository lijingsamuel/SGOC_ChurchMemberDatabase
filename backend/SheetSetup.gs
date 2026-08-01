/**
 * SheetSetup.gs
 * Run setupChurchFamilyDatabase() ONCE from the Apps Script editor (select the
 * function in the dropdown, click Run) to create all sheets, headers, and a
 * couple of sample rows so you can log in and test immediately.
 *
 * Safe to re-run: it will not duplicate sheets that already exist, and will not
 * touch sheets that already have data beyond ensuring the header row is set.
 */

function setupChurchFamilyDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  ensureSheet_(ss, SHEET_VOLUNTEERS, VOLUNTEER_HEADERS, [
    ['Admin', '9999', '9999999999', 'Admin', 'Active'],
    ['Volunteer 1', '1234', '9000000001', 'Volunteer', 'Active'],
    ['Volunteer 2', '1235', '9000000002', 'Volunteer', 'Active'],
    ['Volunteer 3', '1236', '9000000003', 'Volunteer', 'Active'],
    ['Volunteer 4', '1237', '9000000004', 'Volunteer', 'Active'],
    ['Volunteer 5', '1238', '9000000005', 'Volunteer', 'Active']
  ]);

  ensureSheet_(ss, SHEET_FAMILIES, FAMILY_HEADERS, [
    // A couple of "Pending" sample rows representing pre-assigned houses to visit.
    // One '' per FAMILY_HEADERS column — keep this in sync if FAMILY_HEADERS changes.
    ['', '12', '', '', 'Ward 1', 'Central', '', '', '', '', '', '', '', '', '', '', 'India', '', 'Volunteer 1', 'Pending', '', '', ''],
    ['', '45', '', '', 'Ward 2', 'North', '', '', '', '', '', '', '', '', '', '', 'India', '', 'Volunteer 2', 'Pending', '', '', '']
  ]);

  ensureSheet_(ss, SHEET_MEMBERS, MEMBER_HEADERS, []);
  ensureSheet_(ss, SHEET_AUDIT, AUDIT_HEADERS, []);

  // Remove the default "Sheet1" if it's empty and unused.
  var sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && sheet1.getLastRow() === 0) {
    ss.deleteSheet(sheet1);
  }

  SpreadsheetApp.getUi().alert(
    'Setup complete! Sheets created: Volunteers, Families, Members, AuditLog.\n\n' +
    'Sample logins:\nAdmin / 9999\nVolunteer 1 / 1234\n\n' +
    'Now deploy this project as a Web App (Deploy > New deployment > Web app, ' +
    'Execute as: Me, Who has access: Anyone) and paste the /exec URL into ' +
    'frontend/js/config.js as SCRIPT_URL.'
  );
}

function ensureSheet_(ss, name, headers, sampleRows) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  var firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var hasHeaders = firstRow.join('') !== '';
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0057B8').setFontColor('#FFFFFF');
    if (sheet.getLastRow() === 1 && sampleRows && sampleRows.length) {
      sheet.getRange(2, 1, sampleRows.length, headers.length).setValues(sampleRows);
    }
  }
  sheet.autoResizeColumns(1, headers.length);
}

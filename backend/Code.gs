/**
 * Code.gs
 * Entry point for the Apps Script Web App. The frontend (hosted separately, e.g.
 * on GitHub Pages) calls this as a JSON API over POST only, using a text/plain
 * body to avoid triggering a CORS preflight request (which Apps Script cannot
 * answer, since it has no doOptions handler).
 *
 * Request body (JSON string): { action: string, token?: string, data?: object }
 * Response body (JSON string): { ok: true, result } | { ok: false, error, code }
 */

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    result: 'Church Family Data Collection API is running. Use POST requests.'
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonError_('Invalid request body.', 'BAD_REQUEST');
  }

  var action = body.action;
  var token = body.token;
  var data = body.data || {};

  try {
    var result = route_(action, token, data);
    return jsonOk_(result);
  } catch (err) {
    return jsonError_(err.message || String(err), err.code || 'ERROR');
  }
}

function route_(action, token, data) {
  // Public actions (no auth required).
  if (action === 'login') return actionLogin_(data);

  // All other actions require a valid session.
  var session = requireAuth_(token);

  switch (action) {
    case 'verifyToken': return { volunteer: session };
    case 'getDashboard': return actionGetDashboard_(session);
    case 'getFamilies': return actionGetFamilies_(session, data);
    case 'getFamily': return actionGetFamily_(session, data);
    case 'checkDuplicate': return actionCheckDuplicate_(session, data);
    case 'saveFamily': return actionSaveFamily_(session, data);
    case 'deleteFamily': return actionDeleteFamily_(session, data);
    case 'getReports': return actionGetReports_(session);
    case 'getFullExport': return actionGetFullExport_(session);
    case 'getAuditLog': return actionGetAuditLog_(session);
    case 'getVolunteers': return actionGetVolunteers_(session);
    default:
      var err = new Error('Unknown action: ' + action);
      err.code = 'UNKNOWN_ACTION';
      throw err;
  }
}

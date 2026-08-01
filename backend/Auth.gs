/**
 * Auth.gs
 * Simple name+PIN login for volunteers/admins, backed by an HMAC-signed
 * stateless token (no session storage needed in Sheets).
 */

function getTokenSecret_() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('TOKEN_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('TOKEN_SECRET', secret);
  }
  return secret;
}

function createToken_(name, role) {
  var expiry = Date.now() + 1000 * 60 * 60 * 24 * 14; // 14 days
  var payload = JSON.stringify({ name: name, role: role, exp: expiry });
  var payloadB64 = Utilities.base64EncodeWebSafe(payload);
  var sig = Utilities.computeHmacSha256Signature(payloadB64, getTokenSecret_());
  var sigB64 = Utilities.base64EncodeWebSafe(sig);
  return payloadB64 + '.' + sigB64;
}

/** Verifies a token and returns { name, role } or null if invalid/expired. */
function verifyToken_(token) {
  if (!token || token.indexOf('.') === -1) return null;
  var parts = token.split('.');
  var payloadB64 = parts[0];
  var sigB64 = parts[1];
  var expectedSig = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payloadB64, getTokenSecret_())
  );
  if (expectedSig !== sigB64) return null;
  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString());
  } catch (e) {
    return null;
  }
  if (!payload || !payload.exp || payload.exp < Date.now()) return null;
  return { name: payload.name, role: payload.role };
}

function requireAuth_(token) {
  var session = verifyToken_(token);
  if (!session) {
    var err = new Error('Session expired. Please log in again.');
    err.code = 'AUTH_REQUIRED';
    throw err;
  }
  return session;
}

function requireAdmin_(token) {
  var session = requireAuth_(token);
  if (session.role !== 'Admin') {
    var err = new Error('Admin access required.');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return session;
}

/** action: login  data: { name, pin } */
function actionLogin_(data) {
  var name = sanitizeText_(data.name);
  var pin = String(data.pin || '').trim();
  if (!name || !pin) throw new Error('Name and PIN are required.');

  var volunteers = sheetToObjects_(SHEET_VOLUNTEERS);
  var match = volunteers.filter(function (v) {
    return String(v.Name).trim().toLowerCase() === name.toLowerCase() && String(v.PIN).trim() === pin;
  })[0];

  if (!match) {
    var err = new Error('Invalid name or PIN.');
    err.code = 'INVALID_LOGIN';
    throw err;
  }
  if (String(match.Status || 'Active').toLowerCase() !== 'active') {
    throw new Error('This volunteer account is inactive. Contact your admin.');
  }

  var role = String(match.Role || 'Volunteer').trim() || 'Volunteer';
  var token = createToken_(match.Name, role);
  logAudit_(match.Name, 'LOGIN', '', data.device || '');
  return { token: token, volunteer: { name: match.Name, role: role } };
}

/** action: verifyToken  data: {} */
function actionVerifyToken_(token) {
  var session = requireAuth_(token);
  return { volunteer: session };
}

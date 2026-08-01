/**
 * Reports.gs
 * Admin-only aggregate reports, full data export, audit log, volunteer management.
 */

/** action: getReports (admin) */
function actionGetReports_(session) {
  requireAdminRole_(session);
  var families = sheetToObjects_(SHEET_FAMILIES);
  var members = sheetToObjects_(SHEET_MEMBERS);

  var volunteerWise = {};
  families.forEach(function (f) {
    var v = f.Volunteer || 'Unassigned';
    if (!volunteerWise[v]) volunteerWise[v] = { volunteer: v, completed: 0, pending: 0, draft: 0 };
    if (f.Status === STATUS_COMPLETED) volunteerWise[v].completed++;
    else if (f.Status === STATUS_PENDING) volunteerWise[v].pending++;
    else if (f.Status === STATUS_DRAFT) volunteerWise[v].draft++;
  });

  var bloodGroupSummary = {};
  members.forEach(function (m) {
    var bg = m.BloodGroup || 'Unknown';
    bloodGroupSummary[bg] = (bloodGroupSummary[bg] || 0) + 1;
  });

  var ageDistribution = { '0-12': 0, '13-19': 0, '20-35': 0, '36-60': 0, '60+': 0, 'Unknown': 0 };
  members.forEach(function (m) {
    var age = m.Age === '' || m.Age === null || m.Age === undefined ? null : Number(m.Age);
    if (age === null || isNaN(age)) { ageDistribution['Unknown']++; return; }
    if (age <= 12) ageDistribution['0-12']++;
    else if (age <= 19) ageDistribution['13-19']++;
    else if (age <= 35) ageDistribution['20-35']++;
    else if (age <= 60) ageDistribution['36-60']++;
    else ageDistribution['60+']++;
  });

  var todayMD = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kolkata', 'MM-dd');
  var next30 = upcomingWithinDays_(members, 'DOB', 30);
  var anniversaries = upcomingWithinDays_(members, 'WeddingDate', 30);

  return {
    volunteerWise: Object.keys(volunteerWise).map(function (k) { return volunteerWise[k]; }),
    bloodGroupSummary: bloodGroupSummary,
    ageDistribution: ageDistribution,
    birthdays: next30,
    anniversaries: anniversaries,
    totals: {
      families: families.length,
      completed: families.filter(function (f) { return f.Status === STATUS_COMPLETED; }).length,
      pending: families.filter(function (f) { return f.Status === STATUS_PENDING; }).length,
      draft: families.filter(function (f) { return f.Status === STATUS_DRAFT; }).length,
      members: members.length
    }
  };
}

function upcomingWithinDays_(members, field, days) {
  var today = new Date();
  var results = [];
  members.forEach(function (m) {
    var raw = m[field];
    if (!raw) return;
    var d = new Date(raw);
    if (isNaN(d.getTime())) return;
    var next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    if (next < stripTime_(today)) next.setFullYear(today.getFullYear() + 1);
    var diffDays = Math.round((next - stripTime_(today)) / 86400000);
    if (diffDays >= 0 && diffDays <= days) {
      results.push({
        familyId: m.FamilyID,
        name: m.MemberName,
        date: formatDate_(raw),
        nextOccurrence: formatDate_(next),
        daysAway: diffDays
      });
    }
  });
  results.sort(function (a, b) { return a.daysAway - b.daysAway; });
  return results;
}

function stripTime_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** action: getFullExport (admin) - flattened family+member rows for CSV/Excel export */
function actionGetFullExport_(session) {
  requireAdminRole_(session);
  var families = sheetToObjects_(SHEET_FAMILIES);
  var members = sheetToObjects_(SHEET_MEMBERS);
  var byFamily = {};
  members.forEach(function (m) {
    (byFamily[m.FamilyID] = byFamily[m.FamilyID] || []).push(m);
  });

  var rows = [];
  families.forEach(function (f) {
    var fam = familyToClient_(f);
    var mems = byFamily[f.FamilyID] || [];
    if (mems.length === 0) {
      rows.push(flattenRow_(fam, null));
    } else {
      mems.forEach(function (m) { rows.push(flattenRow_(fam, memberToClient_(m))); });
    }
  });
  return { rows: rows };
}

function flattenRow_(fam, mem) {
  return {
    familyId: fam.familyId, houseNumber: fam.houseNumber, familyName: fam.familyName,
    headOfFamily: fam.headOfFamily, prayerGroup: fam.prayerGroup, address: fam.address,
    phone: fam.phone, whatsapp: fam.whatsapp, volunteer: fam.volunteer, status: fam.status,
    updatedDate: fam.updatedDate,
    memberName: mem ? mem.name : '', gender: mem ? mem.gender : '', relation: mem ? mem.relation : '',
    dob: mem ? mem.dob : '', age: mem ? mem.age : '', bloodGroup: mem ? mem.bloodGroup : '',
    memberPhone: mem ? mem.phone : ''
  };
}

/** action: getAuditLog (admin) */
function actionGetAuditLog_(session) {
  requireAdminRole_(session);
  var rows = sheetToObjects_(SHEET_AUDIT);
  rows.sort(function (a, b) { return new Date(b.Timestamp) - new Date(a.Timestamp); });
  return rows.slice(0, 200).map(function (r) {
    return { timestamp: r.Timestamp, volunteer: r.Volunteer, action: r.Action, familyId: r.FamilyID, device: r.Device };
  });
}

/** action: getVolunteers (admin) */
function actionGetVolunteers_(session) {
  requireAdminRole_(session);
  return sheetToObjects_(SHEET_VOLUNTEERS).map(function (v) {
    return { name: v.Name, mobile: v.Mobile, role: v.Role, status: v.Status };
  });
}

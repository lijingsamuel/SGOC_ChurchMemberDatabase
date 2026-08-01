/**
 * Families.gs
 * Dashboard stats, family list/search, family detail, save (create/update/draft),
 * delete, and duplicate detection.
 */

var STATUS_DRAFT = 'Draft';
var STATUS_PENDING = 'Pending';
var STATUS_COMPLETED = 'Completed';

/** action: getDashboard  data: {} */
function actionGetDashboard_(session) {
  var families = sheetToObjects_(SHEET_FAMILIES);
  var members = sheetToObjects_(SHEET_MEMBERS);
  var isAdmin = session.role === 'Admin';
  var mine = isAdmin ? families : families.filter(function (f) { return f.Volunteer === session.name; });

  var todayStr = formatDate_(new Date());
  var collected = mine.filter(function (f) { return f.Status === STATUS_COMPLETED; }).length;
  var pending = mine.filter(function (f) { return f.Status === STATUS_PENDING; }).length;
  var draft = mine.filter(function (f) { return f.Status === STATUS_DRAFT; }).length;
  var todayCount = mine.filter(function (f) {
    return f.Status === STATUS_COMPLETED && formatDate_(f.UpdatedDate) === todayStr;
  }).length;

  var familyIdsMine = {};
  mine.forEach(function (f) { familyIdsMine[f.FamilyID] = true; });
  var totalMembers = members.filter(function (m) { return familyIdsMine[m.FamilyID]; }).length;

  var recent = mine
    .slice()
    .sort(function (a, b) { return new Date(b.UpdatedDate) - new Date(a.UpdatedDate); })
    .slice(0, 5)
    .map(familyToClient_);

  return {
    collected: collected,
    pending: pending,
    draft: draft,
    totalMembers: totalMembers,
    todayCount: todayCount,
    recent: recent
  };
}

function familyToClient_(f) {
  return {
    familyId: f.FamilyID,
    houseNumber: f.HouseNumber,
    familyName: f.FamilyName,
    headOfFamily: f.HeadOfFamily,
    ward: f.Ward,
    area: f.Area,
    houseName: f.HouseName,
    address: f.Address,
    landmark: f.Landmark,
    pinCode: f.PinCode,
    phone: f.Phone,
    whatsapp: f.WhatsApp,
    email: f.Email,
    remarks: f.Remarks,
    district: f.District,
    state: f.State,
    country: f.Country,
    mapLink: f.MapLink,
    volunteer: f.Volunteer,
    status: f.Status,
    createdDate: formatDate_(f.CreatedDate),
    updatedDate: formatDate_(f.UpdatedDate),
    prayerGroup: f.PrayerGroup
  };
}

function memberToClient_(m) {
  return {
    familyId: m.FamilyID,
    memberId: m.MemberID,
    name: m.MemberName,
    gender: m.Gender,
    relation: m.Relation,
    dob: formatDate_(m.DOB),
    age: m.Age,
    weddingDate: formatDate_(m.WeddingDate),
    bloodGroup: m.BloodGroup,
    phone: m.Phone,
    whatsapp: m.WhatsApp,
    email: m.Email,
    occupation: m.Occupation,
    education: m.Education,
    baptismName: m.BaptismName,
    maritalStatus: m.MaritalStatus,
    notes: m.Notes,
    sortOrder: m.SortOrder
  };
}

/** action: getFamilies  data: { filter, search } */
function actionGetFamilies_(session, data) {
  var families = sheetToObjects_(SHEET_FAMILIES);
  var isAdmin = session.role === 'Admin';
  var list = isAdmin ? families : families.filter(function (f) { return f.Volunteer === session.name; });

  var filter = (data && data.filter) || 'All';
  if (filter !== 'All') {
    list = list.filter(function (f) { return f.Status === filter; });
  }

  var search = ((data && data.search) || '').trim().toLowerCase();
  if (search) {
    var members = sheetToObjects_(SHEET_MEMBERS);
    var familyIdsWithMemberMatch = {};
    members.forEach(function (m) {
      var hay = (String(m.MemberName) + ' ' + String(m.BloodGroup)).toLowerCase();
      if (hay.indexOf(search) !== -1) familyIdsWithMemberMatch[m.FamilyID] = true;
    });
    list = list.filter(function (f) {
      var hay = [f.FamilyID, f.FamilyName, f.HouseNumber, f.Phone, f.WhatsApp, f.Volunteer]
        .join(' ').toLowerCase();
      return hay.indexOf(search) !== -1 || familyIdsWithMemberMatch[f.FamilyID];
    });
  }

  list.sort(function (a, b) { return new Date(b.UpdatedDate) - new Date(a.UpdatedDate); });
  return list.map(familyToClient_);
}

/** action: getFamily  data: { familyId } */
function actionGetFamily_(session, data) {
  var familyId = String(data.familyId || '');
  var families = sheetToObjects_(SHEET_FAMILIES);
  var family = families.filter(function (f) { return String(f.FamilyID) === familyId; })[0];
  if (!family) throw new Error('Family not found.');
  if (session.role !== 'Admin' && family.Volunteer !== session.name) {
    throw new Error('You do not have access to this family record.');
  }
  var members = sheetToObjects_(SHEET_MEMBERS)
    .filter(function (m) { return String(m.FamilyID) === familyId; })
    .sort(function (a, b) { return (a.SortOrder || 0) - (b.SortOrder || 0); })
    .map(memberToClient_);

  return { family: familyToClient_(family), members: members };
}

/** action: checkDuplicate  data: { houseNumber, phone, whatsapp, familyName, excludeFamilyId } */
function actionCheckDuplicate_(session, data) {
  var families = sheetToObjects_(SHEET_FAMILIES);
  var houseNumber = String(data.houseNumber || '').trim().toLowerCase();
  var phone = String(data.phone || '').trim();
  var whatsapp = String(data.whatsapp || '').trim();
  var familyName = String(data.familyName || '').trim().toLowerCase();
  var exclude = String(data.excludeFamilyId || '');

  var matches = families.filter(function (f) {
    if (String(f.FamilyID) === exclude) return false;
    var sameHouse = houseNumber && String(f.HouseNumber).trim().toLowerCase() === houseNumber;
    var samePhone = phone && String(f.Phone).trim() === phone;
    var sameWhatsapp = whatsapp && String(f.WhatsApp).trim() === whatsapp;
    var sameName = familyName && String(f.FamilyName).trim().toLowerCase() === familyName;
    return sameHouse || samePhone || sameWhatsapp || sameName;
  });

  return { duplicates: matches.map(familyToClient_) };
}

/**
 * action: saveFamily
 * data: { family: {...fields, familyId?}, members: [...], asDraft: bool }
 *
 * The Family ID entered on the Family Information step (HouseNumber) is the
 * permanent, user-facing unique identifier for the family — it becomes the
 * FamilyID that every member row links to, and it can never change once the
 * family exists. On create, that entered value is used as FamilyID directly
 * (must be unique). On update, FamilyID/HouseNumber are always forced back to
 * the existing value regardless of what the client sends, so it can't be
 * edited or replaced after creation.
 *
 * Replaces the full member list for the family on every save (simplest consistent model).
 *
 * The current wizard no longer sends every FAMILY_HEADERS/MEMBER_HEADERS field
 * (some were removed from the UI). sanitizeFamily_/sanitizeMember_ only include
 * keys that were actually sent, so any field missing here falls back to
 * whatever is already on the existing sheet row instead of being blanked out —
 * this preserves historical data (Ward, Area, District, member Email, etc.)
 * for records collected before those fields were removed from the form.
 */
function actionSaveFamily_(session, data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var input = sanitizeFamily_(data.family || {});
    var members = (data.members || []).map(sanitizeMember_);
    var asDraft = !!data.asDraft;

    var sheet = getSheet_(SHEET_FAMILIES);
    ensureFamilyHeaders_(sheet);
    // Must run before any value is written this call — see forceTextColumn_ doc.
    forceTextColumn_(sheet, 1); // FamilyID
    forceTextColumn_(sheet, 2); // HouseNumber
    var familyId = input.FamilyID;
    var now = nowStamp_();
    var isNew = !familyId;

    var families = sheetToObjects_(SHEET_FAMILIES);

    if (isNew) {
      familyId = String(input.HouseNumber || '').trim();
      if (!familyId) throw new Error('Family ID is required.');
      var clash = families.filter(function (f) { return String(f.FamilyID) === familyId; })[0];
      if (clash) throw new Error('Family ID "' + familyId + '" is already in use. Please choose a different Family ID.');
    }

    var existing = families.filter(function (f) { return String(f.FamilyID) === String(familyId); })[0];

    if (existing && session.role !== 'Admin' && existing.Volunteer && existing.Volunteer !== session.name) {
      throw new Error('This family was collected by another volunteer.');
    }

    var record = {};
    FAMILY_HEADERS.forEach(function (h) {
      if (h === 'FamilyID' || h === 'HouseNumber' || h === 'Volunteer' || h === 'Status' || h === 'CreatedDate' || h === 'UpdatedDate') return;
      if (Object.prototype.hasOwnProperty.call(input, h)) {
        record[h] = input[h];
      } else {
        record[h] = existing ? (existing[h] || '') : '';
      }
    });
    record.FamilyID = familyId;
    // The Family ID is permanent once assigned — always pinned to familyId,
    // never taken from client input, so it can't be modified or replaced.
    record.HouseNumber = familyId;
    record.Volunteer = (existing && existing.Volunteer) || session.name;
    record.Status = asDraft ? STATUS_DRAFT : STATUS_COMPLETED;
    record.CreatedDate = existing ? existing.CreatedDate : now;
    record.UpdatedDate = now;

    if (!asDraft) {
      if (!record.FamilyName) throw new Error('Family Name is required.');
      if (record.Phone && !/^[0-9+\-\s]{7,15}$/.test(record.Phone)) throw new Error('Phone number looks invalid.');
    }

    if (existing) {
      sheet.getRange(existing.__row, 1, 1, FAMILY_HEADERS.length)
        .setValues([objectToRow_(record, FAMILY_HEADERS)]);
    } else {
      sheet.appendRow(objectToRow_(record, FAMILY_HEADERS));
    }

    replaceMembers_(familyId, members);
    logAudit_(session.name, isNew ? 'CREATE_FAMILY' : (asDraft ? 'SAVE_DRAFT' : 'SUBMIT_FAMILY'), familyId, data.device || '');

    return { familyId: familyId, status: record.Status };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Backfills any FAMILY_HEADERS column missing from the live sheet's header row
 * (e.g. PrayerGroup, on a sheet that was set up before that field existed), so
 * newer fields persist without requiring a manual header edit in the sheet.
 * Only ever appends a missing header cell — never touches or reorders an
 * existing one.
 */
function ensureFamilyHeaders_(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var current = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  FAMILY_HEADERS.forEach(function (h, i) {
    if (String(current[i] || '') !== h) {
      sheet.getRange(1, i + 1).setValue(h);
    }
  });
}

function replaceMembers_(familyId, members) {
  var sheet = getSheet_(SHEET_MEMBERS);
  // Must run before any value is written below — see forceTextColumn_ doc.
  forceTextColumn_(sheet, 1); // FamilyID
  var all = sheetToObjects_(SHEET_MEMBERS);
  var existingForFamily = all.filter(function (m) { return String(m.FamilyID) === String(familyId); });
  var existingById = {};
  existingForFamily.forEach(function (m) { existingById[m.MemberID] = m; });

  var rowsToDelete = existingForFamily
    .map(function (m) { return m.__row; })
    .sort(function (a, b) { return b - a; }); // delete bottom-up
  rowsToDelete.forEach(function (r) { sheet.deleteRow(r); });

  members.forEach(function (m, idx) {
    var memberId = m.MemberID || (familyId + '-M' + (idx + 1));
    var existing = existingById[memberId];
    var row = {};
    MEMBER_HEADERS.forEach(function (h) {
      if (h === 'FamilyID' || h === 'MemberID' || h === 'SortOrder' || h === 'Age') return;
      row[h] = Object.prototype.hasOwnProperty.call(m, h) ? m[h] : (existing ? (existing[h] || '') : '');
    });
    row.FamilyID = familyId;
    row.MemberID = memberId;
    row.SortOrder = idx + 1;
    row.Age = m.DOB ? computeAge_(m.DOB) : (('DOB' in m) ? '' : (existing ? existing.Age : ''));
    sheet.appendRow(objectToRow_(row, MEMBER_HEADERS));
  });
}

/** action: deleteFamily (admin only)  data: { familyId } */
function actionDeleteFamily_(session, data) {
  requireAdminRole_(session);
  var familyId = String(data.familyId || '');
  var sheet = getSheet_(SHEET_FAMILIES);
  var families = sheetToObjects_(SHEET_FAMILIES);
  var existing = families.filter(function (f) { return String(f.FamilyID) === familyId; })[0];
  if (!existing) throw new Error('Family not found.');
  sheet.deleteRow(existing.__row);

  var memberSheet = getSheet_(SHEET_MEMBERS);
  var members = sheetToObjects_(SHEET_MEMBERS).filter(function (m) { return String(m.FamilyID) === familyId; })
    .map(function (m) { return m.__row; }).sort(function (a, b) { return b - a; });
  members.forEach(function (r) { memberSheet.deleteRow(r); });

  logAudit_(session.name, 'DELETE_FAMILY', familyId, data.device || '');
  return { deleted: true };
}

function requireAdminRole_(session) {
  if (session.role !== 'Admin') {
    var err = new Error('Admin access required.');
    err.code = 'FORBIDDEN';
    throw err;
  }
}

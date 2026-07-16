/**
 * wizard.js
 * The 4-step stepper: Family Details -> Members -> Review -> Submit.
 * Handles local draft autosave (every 20s + on step change), duplicate
 * detection before final submit, and offline-safe saving via api.js.
 */

import { apiCall } from './api.js';
import { DraftStore } from './db.js';
import { renderMembersStep, hasUnsavedMemberEdit } from './members.js';
import {
  el, toast, confirmDialog, newLocalId, isValidPhone
} from './utils.js';

const STEP_TITLES = ['Family Details', 'Family Members', 'Review', 'Submit'];
let autosaveTimer = null;

function blankFamily() {
  return {
    FamilyID: '', HouseNumber: '', FamilyName: '', HeadOfFamily: '',
    Address: '', Phone: '', WhatsApp: '', Remarks: '', PrayerGroup: ''
  };
}

export async function renderWizard(root, navigate, params) {
  clearInterval(autosaveTimer);
  const familyId = params.id || '';
  const localId = familyId || newLocalId();

  let state = { localId, family: blankFamily(), members: [], step: 1, isNew: !familyId, submitted: false };

  root.innerHTML = '<div class="skeleton-row"></div>';

  try {
    if (familyId) {
      const res = await apiCall('getFamily', { familyId });
      state.family = { ...blankFamily(), ...res.family, FamilyID: res.family.familyId };
      normalizeFamilyKeys_(state.family, res.family);
      state.members = res.members.map(m => normalizeMemberKeys_(m));
      state.isNew = false;
    }

    const draft = await DraftStore.get(localId);
    if (draft && draft.step) {
      const restore = await confirmDialog({
        title: 'Restore unsaved draft?',
        message: 'We found unsaved changes for this family from a previous session. Restore them?',
        confirmLabel: 'Restore', cancelLabel: 'Discard'
      });
      if (restore) {
        state.family = draft.family;
        state.members = draft.members;
        state.step = draft.step;
        toast('Draft restored.', 'info');
      } else {
        await DraftStore.remove(localId);
      }
    }
  } catch (err) {
    toast(err.message || 'Could not load family.', 'error');
  }

  autosaveTimer = setInterval(() => saveLocalDraft(state), 20000);
  window.addEventListener('hashchange', () => clearInterval(autosaveTimer), { once: true });

  state.root = root;
  renderShell(root, navigate, state);
}

function normalizeFamilyKeys_(target, source) {
  const map = {
    HouseNumber: 'houseNumber', FamilyName: 'familyName', HeadOfFamily: 'headOfFamily',
    Address: 'address', Phone: 'phone', WhatsApp: 'whatsapp', Remarks: 'remarks',
    PrayerGroup: 'prayerGroup'
  };
  Object.entries(map).forEach(([sheetKey, clientKey]) => { target[sheetKey] = source[clientKey] || ''; });
}

function normalizeMemberKeys_(m) {
  return {
    MemberID: m.memberId || '', MemberName: m.name || '', Gender: m.gender || '',
    Relation: m.relation || 'Head', DOB: m.dob || '', Age: m.age || '', WeddingDate: m.weddingDate || '',
    BloodGroup: m.bloodGroup || '', Phone: m.phone || '', WhatsApp: m.whatsapp || '',
    MaritalStatus: m.maritalStatus || 'Single'
  };
}

async function saveLocalDraft(state) {
  if (state.submitted) return;
  await DraftStore.save({
    localId: state.localId, family: state.family, members: state.members, step: state.step, savedAt: Date.now()
  });
}

function renderShell(root, navigate, state) {
  root.innerHTML = '';
  root.appendChild(renderStepper(state));
  const body = el('div', { class: 'wizard-body' });
  root.appendChild(body);
  const footer = el('div', { class: 'wizard-footer' });
  root.appendChild(footer);

  renderStepBody(body, footer, navigate, state);
}

function renderStepper(state) {
  const stepper = el('div', { class: 'stepper' });
  STEP_TITLES.forEach((title, i) => {
    const num = i + 1;
    const cls = ['stepper__step'];
    if (num === state.step) cls.push('stepper__step--active');
    if (num < state.step) cls.push('stepper__step--done');
    stepper.appendChild(el('div', { class: cls.join(' ') }, [
      el('div', { class: 'stepper__circle' }, [num < state.step ? '✓' : String(num)]),
      el('div', { class: 'stepper__label' }, [title])
    ]));
  });
  return stepper;
}

function renderStepBody(body, footer, navigate, state) {
  body.innerHTML = '';
  footer.innerHTML = '';

  if (state.step === 1) renderStep1(body, state);
  else if (state.step === 2) {
    const rerenderStep2 = () => { renderMembersStep(body, state, () => { saveLocalDraft(state); rerenderStep2(); }); };
    rerenderStep2();
  } else if (state.step === 3) renderReview(body, state, (jumpStep) => { state.step = jumpStep; renderShell(state.root, navigate, state); });
  else if (state.step === 4) {
    const shouldSave = state.pendingSave;
    state.pendingSave = false;
    return renderSubmitStep(body, footer, navigate, state, shouldSave);
  }

  footer.appendChild(renderFooterNav(body, footer, navigate, state));
}

function renderFooterNav(body, footer, navigate, state) {
  const nav = el('div', { class: 'wizard-nav' });
  if (state.step > 1) {
    nav.appendChild(el('button', {
      class: 'btn btn--ghost', onclick: () => { state.step--; renderShell(state.root, navigate, state); }
    }, ['Back']));
  } else {
    nav.appendChild(el('button', {
      class: 'btn btn--ghost',
      onclick: async () => {
        const ok = await confirmDialog({ title: 'Exit to Dashboard?', message: 'Your progress is saved as a local draft.' });
        if (ok) { await saveLocalDraft(state); navigate('#/dashboard'); }
      }
    }, ['Cancel']));
  }

  nav.appendChild(el('button', {
    class: 'btn btn--ghost',
    onclick: async () => { await saveLocalDraft(state); toast('Draft saved on this device.', 'info'); }
  }, ['Save Draft']));

  if (state.step < 3) {
    nav.appendChild(el('button', {
      class: 'btn btn--primary',
      onclick: () => {
        if (!validateStep(state)) return;
        state.step++;
        saveLocalDraft(state);
        renderShell(state.root, navigate, state);
      }
    }, ['Next']));
  } else if (state.step === 3) {
    nav.appendChild(el('button', {
      class: 'btn btn--primary',
      onclick: () => submitFamily(body, footer, navigate, state)
    }, ['Submit']));
  }
  return nav;
}

function membersMissingGender(state) {
  return state.members.some(m => !m.Gender || !m.Gender.trim());
}

function validateStep(state) {
  const f = state.family;
  if (state.step === 1) {
    if (!f.HouseNumber.trim()) { toast('Family ID is required.', 'warning'); return false; }
    if (!f.FamilyName.trim()) { toast('Family Name is required.', 'warning'); return false; }
    if (!isValidPhone(f.Phone)) { toast('Phone Number looks invalid.', 'warning'); return false; }
    if (!isValidPhone(f.WhatsApp)) { toast('WhatsApp Number looks invalid.', 'warning'); return false; }
  }
  if (state.step === 2) {
    if (hasUnsavedMemberEdit()) {
      toast('Please save or cancel the member you are currently editing before continuing.', 'warning');
      return false;
    }
    if (membersMissingGender(state)) {
      toast('Gender is required for every family member.', 'warning');
      return false;
    }
  }
  return true;
}

function renderStep1(body, state) {
  const f = state.family;
  body.appendChild(el('h2', { class: 'step-title' }, ['Family Information']));
  grid(body, [
    state.isNew
      ? input('Family ID *', f, 'HouseNumber')
      : readonly('Family ID', f.HouseNumber),
    input('Family Name *', f, 'FamilyName'),
    input('Head of Family', f, 'HeadOfFamily'),
    input('Address', f, 'Address'),
    input('Phone Number', f, 'Phone', 'tel'),
    input('WhatsApp Number', f, 'WhatsApp', 'tel'),
    input('Prayer Group', f, 'PrayerGroup')
  ]);
  body.appendChild(textarea('Remarks', f, 'Remarks'));
}

function renderReview(body, state, jumpTo) {
  const f = state.family;
  body.appendChild(el('h2', { class: 'step-title' }, ['Review']));

  body.appendChild(reviewSection('Family Details', 1, jumpTo, [
    ['Family ID', f.HouseNumber], ['Family Name', f.FamilyName], ['Head of Family', f.HeadOfFamily],
    ['Address', f.Address], ['Phone', f.Phone], ['WhatsApp', f.WhatsApp],
    ['Prayer Group', f.PrayerGroup], ['Remarks', f.Remarks]
  ]));

  const membersBox = el('div', { class: 'review-section' }, [
    el('div', { class: 'review-section__header' }, [
      el('h3', {}, [`Family Members (${state.members.length})`]),
      el('button', { class: 'btn btn--ghost btn--small', onclick: () => jumpTo(2) }, ['Edit'])
    ])
  ]);
  if (!state.members.length) {
    membersBox.appendChild(el('p', { class: 'step-hint' }, ['No members added.']));
  } else {
    state.members.forEach(m => {
      membersBox.appendChild(el('div', { class: 'review-member' }, [
        el('strong', {}, [m.MemberName || '(Unnamed)']),
        el('span', {}, [` — ${m.Relation}, ${m.Gender}, ${m.Age !== '' ? m.Age + ' yrs' : ''}`])
      ]));
    });
  }
  body.appendChild(membersBox);
}

function reviewSection(title, stepNum, jumpTo, pairs) {
  const box = el('div', { class: 'review-section' }, [
    el('div', { class: 'review-section__header' }, [
      el('h3', {}, [title]),
      el('button', { class: 'btn btn--ghost btn--small', onclick: () => jumpTo(stepNum) }, ['Edit'])
    ])
  ]);
  pairs.forEach(([label, value]) => {
    if (!value) return;
    box.appendChild(el('div', { class: 'review-row' }, [
      el('span', { class: 'review-row__label' }, [label]),
      el('span', { class: 'review-row__value' }, [String(value)])
    ]));
  });
  return box;
}

async function submitFamily(body, footer, navigate, state) {
  if (membersMissingGender(state)) {
    toast('Gender is required for every family member.', 'warning');
    state.step = 2;
    renderShell(state.root, navigate, state);
    return;
  }

  try {
    const dup = await apiCall('checkDuplicate', {
      houseNumber: state.family.HouseNumber, phone: state.family.Phone,
      whatsapp: state.family.WhatsApp, familyName: state.family.FamilyName,
      excludeFamilyId: state.family.FamilyID
    });
    if (dup.duplicates && dup.duplicates.length) {
      const names = dup.duplicates.map(d => `${d.familyName || '(unnamed)'} (House ${d.houseNumber})`).join(', ');
      const proceed = await confirmDialog({
        title: 'This family may already exist',
        message: `Possible match: ${names}. Continue submitting as a new/updated record anyway?`,
        confirmLabel: 'Continue', cancelLabel: 'Cancel'
      });
      if (!proceed) return;
    }
  } catch (err) {
    // If duplicate check fails (e.g. offline), fall through and let saveFamily queue/save.
  }

  state.step = 4;
  state.pendingSave = true;
  renderShell(state.root, navigate, state);
}

async function renderSubmitStep(body, footer, navigate, state, doSave) {
  body.innerHTML = '';
  footer.innerHTML = '';
  body.appendChild(el('div', { class: 'submit-loading' }, ['Saving…']));

  if (!doSave) return;

  try {
    const result = await apiCall('saveFamily', {
      family: state.family, members: state.members, asDraft: false, device: navigator.userAgent
    });
    state.submitted = true;
    await DraftStore.remove(state.localId);
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'success-screen' }, [
      el('div', { class: 'success-checkmark' }, ['✓']),
      el('h2', {}, ['Family Saved Successfully']),
      el('p', {}, [`Family ID: ${result.familyId}`]),
      el('button', { class: 'btn btn--primary btn--large', onclick: () => navigate('#/dashboard') }, ['Return to Dashboard'])
    ]));
  } catch (err) {
    if (err.code === 'OFFLINE_QUEUED') {
      state.submitted = true;
      await DraftStore.remove(state.localId);
      body.innerHTML = '';
      body.appendChild(el('div', { class: 'success-screen' }, [
        el('div', { class: 'success-checkmark success-checkmark--offline' }, ['⏳']),
        el('h2', {}, ['Saved Offline']),
        el('p', {}, ['No connection right now — this family will sync automatically once you’re back online.']),
        el('button', { class: 'btn btn--primary btn--large', onclick: () => navigate('#/dashboard') }, ['Return to Dashboard'])
      ]));
      return;
    }
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'empty-state' }, [err.message || 'Could not save. Please try again.']));
    footer.appendChild(el('button', {
      class: 'btn btn--primary', onclick: () => { state.step = 3; renderShell(state.root, navigate, state); }
    }, ['Back to Review']));
  }
}

// --- small field builders -------------------------------------------------

function grid(container, fields) {
  const wrap = el('div', { class: 'field-grid' }, fields);
  container.appendChild(wrap);
}

function input(label, obj, key, type) {
  const required = label.endsWith('*');
  const field = el('input', {
    class: 'input', type: type || 'text', value: obj[key] || '',
    oninput: (e) => { obj[key] = e.target.value; }
  });
  return el('div', { class: 'field' }, [
    el('label', { class: 'field-label' }, [label]),
    field
  ]);
}

function textarea(label, obj, key) {
  return el('div', { class: 'field' }, [
    el('label', { class: 'field-label' }, [label]),
    el('textarea', { class: 'input textarea', rows: '3', oninput: (e) => { obj[key] = e.target.value; } }, [obj[key] || ''])
  ]);
}

function readonly(label, value) {
  return el('div', { class: 'field' }, [
    el('label', { class: 'field-label' }, [label]),
    el('input', { class: 'input', value: value, disabled: 'disabled' })
  ]);
}

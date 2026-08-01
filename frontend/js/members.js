/**
 * members.js
 * Rendering + interaction for the Family Members step (step 2) of the wizard:
 * add/edit/delete/reorder an unlimited list of members as inline expandable cards.
 *
 * Editing uses a draft (working-copy) model: opening a card snapshots it into
 * `draft`, form fields bind to that draft, and only Save commits it back into
 * state.members[idx]. Cancel discards the draft — and removes the row entirely
 * if it was a brand-new member that was never saved.
 */

import { el, toast, calcAge, isValidPhone } from './utils.js';
import { GENDERS, RELATIONS, BLOOD_GROUPS, MARITAL_STATUSES } from './config.js';

let expandedIndex = null;
let draft = null;
let isNewMember = false;

/** True while a member's form is open and not yet saved/cancelled — callers
 *  (e.g. the wizard's Next button) should block navigation until resolved. */
export function hasUnsavedMemberEdit() {
  return expandedIndex !== null;
}

export function renderMembersStep(container, state, onChange) {
  container.innerHTML = '';
  container.appendChild(el('p', { class: 'step-hint' }, ['Add every person living in this household. Tap a member to edit.']));

  const list = el('div', { class: 'member-list' });
  state.members.forEach((member, idx) => list.appendChild(renderMemberCard(member, idx, state, onChange)));
  container.appendChild(list);

  container.appendChild(el('button', {
    class: 'btn btn--secondary btn--block',
    onclick: () => {
      if (expandedIndex !== null) {
        toast('Please save or cancel the member you are currently editing first.', 'warning');
        return;
      }
      state.members.push(blankMember());
      expandedIndex = state.members.length - 1;
      isNewMember = true;
      draft = { ...state.members[expandedIndex] };
      onChange();
    }
  }, ['➕ Add Family Member']));

  if (!state.members.length) {
    container.querySelector('.member-list').appendChild(
      el('div', { class: 'empty-state' }, ['No members added yet.'])
    );
  }
}

function blankMember() {
  return {
    MemberID: '', MemberName: '', Gender: '', Relation: 'Head', DOB: '', Age: '',
    WeddingDate: '', BloodGroup: '', Phone: '', WhatsApp: '', MaritalStatus: 'Single'
  };
}

function renderMemberCard(member, idx, state, onChange) {
  const isOpen = expandedIndex === idx;
  const card = el('div', { class: 'member-card' + (isOpen ? ' member-card--open' : '') });

  const header = el('div', {
    class: 'member-card__header',
    onclick: () => {
      if (isOpen) return; // use the Save/Cancel buttons below to close
      if (expandedIndex !== null) {
        toast('Please save or cancel the member you are currently editing first.', 'warning');
        return;
      }
      expandedIndex = idx;
      isNewMember = false;
      draft = { ...member };
      onChange();
    }
  }, [
    el('div', {}, [
      el('div', { class: 'member-card__name' }, [member.MemberName || `Member ${idx + 1}`]),
      el('div', { class: 'member-card__meta' }, [
        [member.Relation, member.Gender, member.Age !== '' ? member.Age + ' yrs' : ''].filter(Boolean).join(' • ')
      ])
    ]),
    el('div', { class: 'member-card__controls' }, [
      reorderBtn('▲', idx === 0 || isOpen, () => { swap(state.members, idx, idx - 1); onChange(); }),
      reorderBtn('▼', idx === state.members.length - 1 || isOpen, () => { swap(state.members, idx, idx + 1); onChange(); }),
      el('button', {
        class: 'icon-btn icon-btn--danger', title: 'Delete member',
        onclick: (e) => {
          e.stopPropagation();
          state.members.splice(idx, 1);
          expandedIndex = null;
          draft = null;
          isNewMember = false;
          onChange();
        }
      }, ['🗑'])
    ])
  ]);
  card.appendChild(header);

  if (isOpen) {
    card.appendChild(renderMemberForm(draft, idx, state, onChange));
  }
  return card;
}

function reorderBtn(label, disabled, onClick) {
  return el('button', {
    class: 'icon-btn', disabled: disabled,
    onclick: (e) => { e.stopPropagation(); if (!disabled) onClick(); }
  }, [label]);
}

function swap(arr, i, j) {
  const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
}

function saveMemberEdit(idx, state, onChange) {
  if (!draft.Gender || !draft.Gender.trim()) {
    toast('Gender is required for every family member.', 'warning');
    return;
  }
  state.members[idx] = draft;
  expandedIndex = null;
  draft = null;
  isNewMember = false;
  onChange();
}

function cancelMemberEdit(idx, state, onChange) {
  if (isNewMember) {
    state.members.splice(idx, 1);
  }
  expandedIndex = null;
  draft = null;
  isNewMember = false;
  onChange();
}

function renderMemberForm(draftMember, idx, state, onChange) {
  const form = el('div', { class: 'member-card__form' });

  form.appendChild(textField('Member Name', draftMember, 'MemberName', { required: true }));
  form.appendChild(selectField('Gender', draftMember, 'Gender', GENDERS, { placeholder: 'Select Gender', required: true }));
  form.appendChild(selectField('Relation', draftMember, 'Relation', RELATIONS));
  form.appendChild(dobField('Date of Birth', draftMember, 'DOB', (val) => {
    draftMember.Age = calcAge(val);
    onChange(true);
  }));
  form.appendChild(readonlyField('Age', draftMember.Age !== '' ? `${draftMember.Age} years` : 'Enter DOB'));
  form.appendChild(dateField('Wedding Date', draftMember, 'WeddingDate'));
  form.appendChild(selectField('Blood Group', draftMember, 'BloodGroup', BLOOD_GROUPS));
  form.appendChild(textField('Phone Number', draftMember, 'Phone', { type: 'tel', validate: isValidPhone, errorMsg: 'Invalid phone number' }));
  form.appendChild(textField('WhatsApp Number', draftMember, 'WhatsApp', { type: 'tel', validate: isValidPhone, errorMsg: 'Invalid phone number' }));
  form.appendChild(selectField('Marital Status', draftMember, 'MaritalStatus', MARITAL_STATUSES));

  form.appendChild(el('div', { class: 'wizard-nav member-card__actions' }, [
    el('button', {
      class: 'btn btn--ghost', type: 'button',
      onclick: () => cancelMemberEdit(idx, state, onChange)
    }, ['Cancel']),
    el('button', {
      class: 'btn btn--primary', type: 'button',
      onclick: () => saveMemberEdit(idx, state, onChange)
    }, ['Save'])
  ]));

  return form;
}

function fieldWrap(label, inputNode) {
  return el('div', { class: 'field' }, [el('label', { class: 'field-label' }, [label]), inputNode]);
}

function textField(label, obj, key, opts) {
  opts = opts || {};
  const input = el('input', {
    class: 'input', type: opts.type || 'text', value: obj[key] || '',
    oninput: (e) => {
      obj[key] = e.target.value;
      if (opts.validate) {
        e.target.classList.toggle('input--invalid', !opts.validate(e.target.value));
      }
    }
  });
  return fieldWrap(label + (opts.required ? ' *' : ''), input);
}

function dateField(label, obj, key, onExtra) {
  const input = el('input', {
    class: 'input', type: 'date', value: obj[key] || '',
    oninput: (e) => { obj[key] = e.target.value; if (onExtra) onExtra(e.target.value); }
  });
  return fieldWrap(label, input);
}

function pad2(n) { return String(n).padStart(2, '0'); }

/** Splits a stored 'yyyy-MM-dd' value (the format the backend already reads/
 *  writes via formatDate_) into display parts. Non-ISO/blank values yield
 *  blank parts so old or malformed rows just show an empty field instead of
 *  throwing. */
function isoToDobParts(iso) {
  const m = typeof iso === 'string' && /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return { day: '', month: '', year: '' };
  return { year: m[1], month: m[2], day: m[3] };
}

/** Returns the 'yyyy-MM-dd' string for a real calendar date, or null if the
 *  day/month/year combination doesn't exist (e.g. 31/02) — relies on the
 *  Date constructor's day-rollover to detect that rather than a leap-year
 *  lookup table. */
function dobPartsToIso(day, month, year) {
  const d = Number(day), m = Number(month), y = Number(year);
  if (!d || !m || !y || String(year).length !== 4) return null;
  if (d < 1 || d > 31 || m < 1 || m > 12) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Date of Birth as three plain-text Day/Month/Year inputs (mobile numeric
 * keyboards, no native date-input locale quirks) plus a calendar icon that
 * opens a hidden native <input type="date"> picker and fans its value back
 * out into the three fields. Whatever the user does, `obj[key]` is only ever
 * set to a real 'yyyy-MM-dd' string (or '' while incomplete/invalid) — the
 * same format the sheet/backend already store, so sync and old records are
 * unaffected.
 */
function dobField(label, obj, key, onExtra) {
  const initial = isoToDobParts(obj[key]);
  const errorEl = el('div', { class: 'form-error' }, ['']);

  const dayInput = el('input', {
    class: 'input dob-input dob-input--day', type: 'text', inputmode: 'numeric',
    autocomplete: 'bday-day', maxlength: '2', placeholder: 'DD', value: initial.day,
    oninput: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 2); sync(); },
    onblur: (e) => { if (e.target.value) e.target.value = pad2(e.target.value); sync(); }
  });
  const monthInput = el('input', {
    class: 'input dob-input dob-input--month', type: 'text', inputmode: 'numeric',
    autocomplete: 'bday-month', maxlength: '2', placeholder: 'MM', value: initial.month,
    oninput: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 2); sync(); },
    onblur: (e) => { if (e.target.value) e.target.value = pad2(e.target.value); sync(); }
  });
  const yearInput = el('input', {
    class: 'input dob-input dob-input--year', type: 'text', inputmode: 'numeric',
    autocomplete: 'bday-year', maxlength: '4', placeholder: 'YYYY', value: initial.year,
    oninput: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); sync(); }
  });

  const nativePicker = el('input', {
    class: 'dob-native-picker', type: 'date', tabindex: '-1',
    value: dobPartsToIso(initial.day, initial.month, initial.year) || '',
    onchange: (e) => {
      const parts = isoToDobParts(e.target.value);
      dayInput.value = parts.day ? pad2(parts.day) : '';
      monthInput.value = parts.month ? pad2(parts.month) : '';
      yearInput.value = parts.year;
      sync();
    }
  });

  const calendarBtn = el('button', {
    class: 'icon-btn dob-calendar-btn', type: 'button',
    title: 'Open date picker', 'aria-label': 'Open date picker',
    onclick: () => {
      if (typeof nativePicker.showPicker === 'function') {
        try { nativePicker.showPicker(); return; } catch (err) { /* unsupported context, fall through */ }
      }
      nativePicker.focus();
      nativePicker.click();
    }
  }, ['📅']);

  // The parent view fully re-renders the member list/form on every onExtra
  // call (same as the old single date-input's onChange wiring), which would
  // destroy and recreate these input nodes — and the focus/cursor along with
  // them — on EVERY keystroke if we called it unconditionally. A native
  // <input type="date"> never had this problem because it only fires
  // input/change once a complete valid date exists across all its internal
  // segments. We replicate that: local validity feedback (classes/error text)
  // updates on every keystroke without cost, but onExtra (and therefore the
  // re-render) only fires when the resolved value actually changes.
  let lastIso = obj[key] || '';

  function sync() {
    [dayInput, monthInput, yearInput].forEach(i => i.classList.remove('input--invalid'));

    const day = dayInput.value, month = monthInput.value, year = yearInput.value;
    const dayBad = day.length === 2 && (Number(day) < 1 || Number(day) > 31);
    const monthBad = month.length === 2 && (Number(month) < 1 || Number(month) > 12);
    const yearBad = year.length === 4 && (Number(year) < 1900 || Number(year) > new Date().getFullYear());

    errorEl.textContent = '';
    if (dayBad) { dayInput.classList.add('input--invalid'); errorEl.textContent = 'Day must be between 1 and 31.'; }
    else if (monthBad) { monthInput.classList.add('input--invalid'); errorEl.textContent = 'Month must be between 1 and 12.'; }
    else if (yearBad) { yearInput.classList.add('input--invalid'); errorEl.textContent = 'Enter a valid year.'; }

    const allFilled = day && month && year.length === 4;
    let iso = '';
    if (allFilled && !dayBad && !monthBad && !yearBad) {
      iso = dobPartsToIso(day, month, year) || '';
      if (!iso) {
        [dayInput, monthInput, yearInput].forEach(i => i.classList.add('input--invalid'));
        errorEl.textContent = "That date doesn't exist — check the day and month.";
      }
    }

    obj[key] = iso;
    nativePicker.value = iso;
    if (iso !== lastIso) {
      lastIso = iso;
      if (onExtra) onExtra(iso);
    }
  }

  const row = el('div', { class: 'dob-field' }, [dayInput, monthInput, yearInput, calendarBtn, nativePicker]);
  return fieldWrap(label, el('div', {}, [row, errorEl]));
}

function readonlyField(label, value) {
  return fieldWrap(label, el('input', { class: 'input', value: value, disabled: true }));
}

function selectField(label, obj, key, options, opts) {
  opts = opts || {};
  const currentEmpty = !obj[key];
  const optionNodes = [];
  if (opts.placeholder && currentEmpty) {
    optionNodes.push(el('option', { value: '', selected: true, disabled: true }, [opts.placeholder]));
  }
  options.forEach(opt => optionNodes.push(el('option', {
    value: opt, selected: obj[key] === opt
  }, [opt])));
  const select = el('select', {
    class: 'input select' + (opts.required && currentEmpty ? ' input--invalid' : ''),
    onchange: (e) => {
      obj[key] = e.target.value;
      if (opts.required) {
        e.target.classList.toggle('input--invalid', !e.target.value);
      }
    }
  }, optionNodes);
  return fieldWrap(label + (opts.required ? ' *' : ''), select);
}

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
  form.appendChild(dateField('Date of Birth', draftMember, 'DOB', (val) => {
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

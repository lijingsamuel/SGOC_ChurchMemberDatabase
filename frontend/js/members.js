/**
 * members.js
 * Rendering + interaction for the Family Members step (step 2) of the wizard:
 * add/edit/delete/reorder an unlimited list of members as inline expandable cards.
 */

import { el, toast, calcAge, isValidPhone } from './utils.js';
import { GENDERS, RELATIONS, BLOOD_GROUPS, MARITAL_STATUSES } from './config.js';

let expandedIndex = null;

export function renderMembersStep(container, state, onChange) {
  container.innerHTML = '';
  container.appendChild(el('p', { class: 'step-hint' }, ['Add every person living in this household. Tap a member to edit.']));

  const list = el('div', { class: 'member-list' });
  state.members.forEach((member, idx) => list.appendChild(renderMemberCard(member, idx, state, onChange)));
  container.appendChild(list);

  container.appendChild(el('button', {
    class: 'btn btn--secondary btn--block',
    onclick: () => {
      const missingIdx = state.members.findIndex(m => !m.Gender || !m.Gender.trim());
      if (missingIdx !== -1) {
        toast('Please select Gender for the existing member before adding another.', 'warning');
        expandedIndex = missingIdx;
        onChange();
        return;
      }
      state.members.push(blankMember());
      expandedIndex = state.members.length - 1;
      onChange();
    }
  }, ['➕ Add Member']));

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
    onclick: () => { expandedIndex = isOpen ? null : idx; onChange(); }
  }, [
    el('div', {}, [
      el('div', { class: 'member-card__name' }, [member.MemberName || `Member ${idx + 1}`]),
      el('div', { class: 'member-card__meta' }, [
        [member.Relation, member.Gender, member.Age !== '' ? member.Age + ' yrs' : ''].filter(Boolean).join(' • ')
      ])
    ]),
    el('div', { class: 'member-card__controls' }, [
      reorderBtn('▲', idx === 0, () => { swap(state.members, idx, idx - 1); onChange(); }),
      reorderBtn('▼', idx === state.members.length - 1, () => { swap(state.members, idx, idx + 1); onChange(); }),
      el('button', {
        class: 'icon-btn icon-btn--danger', title: 'Delete member',
        onclick: (e) => { e.stopPropagation(); state.members.splice(idx, 1); expandedIndex = null; onChange(); }
      }, ['🗑'])
    ])
  ]);
  card.appendChild(header);

  if (isOpen) {
    card.appendChild(renderMemberForm(member, onChange));
  }
  return card;
}

function reorderBtn(label, disabled, onClick) {
  return el('button', {
    class: 'icon-btn', disabled: disabled ? 'disabled' : undefined,
    onclick: (e) => { e.stopPropagation(); if (!disabled) onClick(); }
  }, [label]);
}

function swap(arr, i, j) {
  const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
}

function renderMemberForm(member, onChange) {
  const form = el('div', { class: 'member-card__form' });

  form.appendChild(textField('Member Name', member, 'MemberName', { required: true }));
  form.appendChild(selectField('Gender', member, 'Gender', GENDERS, { placeholder: 'Select Gender', required: true }));
  form.appendChild(selectField('Relation', member, 'Relation', RELATIONS));
  form.appendChild(dateField('Date of Birth', member, 'DOB', (val) => {
    member.Age = calcAge(val);
    onChange(true);
  }));
  form.appendChild(readonlyField('Age', member.Age !== '' ? `${member.Age} years` : 'Enter DOB'));
  form.appendChild(dateField('Wedding Date', member, 'WeddingDate'));
  form.appendChild(selectField('Blood Group', member, 'BloodGroup', BLOOD_GROUPS));
  form.appendChild(textField('Phone Number', member, 'Phone', { type: 'tel', validate: isValidPhone, errorMsg: 'Invalid phone number' }));
  form.appendChild(textField('WhatsApp Number', member, 'WhatsApp', { type: 'tel', validate: isValidPhone, errorMsg: 'Invalid phone number' }));
  form.appendChild(selectField('Marital Status', member, 'MaritalStatus', MARITAL_STATUSES));

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
  return fieldWrap(label, el('input', { class: 'input', value: value, disabled: 'disabled' }));
}

function selectField(label, obj, key, options, opts) {
  opts = opts || {};
  const currentEmpty = !obj[key];
  const optionNodes = [];
  if (opts.placeholder && currentEmpty) {
    optionNodes.push(el('option', { value: '', selected: 'selected', disabled: 'disabled' }, [opts.placeholder]));
  }
  options.forEach(opt => optionNodes.push(el('option', {
    value: opt, selected: obj[key] === opt ? 'selected' : undefined
  }, [opt])));
  const select = el('select', {
    class: 'input select' + (opts.required && currentEmpty ? ' input--invalid' : ''),
    onchange: (e) => { obj[key] = e.target.value; }
  }, optionNodes);
  return fieldWrap(label + (opts.required ? ' *' : ''), select);
}

/**
 * utils.js
 * Validation, formatting, toast/dialog UI helpers shared across views.
 */

export function qs(sel, root) { return (root || document).querySelector(sel); }
export function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

export function el(tag, attrs, children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === false) return;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  });
  (children || []).forEach(c => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return node;
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function newLocalId() {
  return 'local-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function calcAge(dobStr) {
  if (!dobStr) return '';
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : '';
}

export function isValidPhone(value) {
  if (!value) return true; // optional in most places; required-ness checked separately
  return /^[0-9+\-\s]{7,15}$/.test(value);
}

export function isValidEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidPin(value) {
  if (!value) return true;
  return /^\d{4,10}$/.test(value);
}

/** Toast notifications: success | warning | error | info */
export function toast(message, type) {
  const container = qs('#toast-container');
  if (!container) return;
  const node = el('div', { class: `toast toast--${type || 'info'}` }, [message]);
  container.appendChild(node);
  requestAnimationFrame(() => node.classList.add('toast--visible'));
  setTimeout(() => {
    node.classList.remove('toast--visible');
    setTimeout(() => node.remove(), 250);
  }, 3200);
}

/** Promise-based confirm dialog replacing window.confirm with app styling. */
export function confirmDialog({ title, message, confirmLabel, cancelLabel, danger }) {
  return new Promise(resolve => {
    const overlay = el('div', { class: 'dialog-overlay' });
    const actions = el('div', { class: 'dialog-actions' }, [
      el('button', { class: 'btn btn--ghost', onclick: () => { close(false); } }, [cancelLabel || 'Cancel']),
      el('button', { class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, onclick: () => { close(true); } }, [confirmLabel || 'Confirm'])
    ]);
    const box = el('div', { class: 'dialog-box' }, [
      el('h3', {}, [title || 'Please confirm']),
      el('p', {}, [message || '']),
      actions
    ]);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function close(result) {
      overlay.remove();
      resolve(result);
    }
    overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
  });
}

export function toCsv(rows) {
  if (!rows || !rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escapeCell = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.join(',')];
  rows.forEach(r => lines.push(headers.map(h => escapeCell(r[h])).join(',')));
  return lines.join('\n');
}

export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function statusBadgeClass(status) {
  switch (status) {
    case 'Completed': return 'badge badge--completed';
    case 'Draft': return 'badge badge--draft';
    default: return 'badge badge--pending';
  }
}

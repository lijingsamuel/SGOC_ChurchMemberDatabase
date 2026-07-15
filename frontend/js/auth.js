/**
 * auth.js
 * Login screen and session helpers.
 */

import { apiCall, getSession, setSession, clearSession } from './api.js';
import { el, qs, toast, isValidPin } from './utils.js';
import { CONFIG } from './config.js';

export function isLoggedIn() {
  return !!getSession();
}

export function currentVolunteer() {
  return getSession();
}

export function logout(navigate) {
  clearSession();
  toast('Logged out.', 'info');
  navigate('#/login');
}

export function renderLogin(root, navigate) {
  root.innerHTML = '';
  const form = el('form', { class: 'auth-card', onsubmit: handleSubmit });

  const nameInput = el('input', {
    id: 'login-name', class: 'input', type: 'text', placeholder: 'e.g. Volunteer 1',
    autocomplete: 'username', required: 'required'
  });
  const pinInput = el('input', {
    id: 'login-pin', class: 'input', type: 'password', inputmode: 'numeric',
    placeholder: 'PIN', autocomplete: 'current-password', required: 'required'
  });
  const errorBox = el('div', { class: 'form-error', id: 'login-error' });

  form.appendChild(el('div', { class: 'auth-brand' }, [
    el('div', { class: 'auth-brand__icon' }, ['⛪']),
    el('h1', {}, [CONFIG.APP_NAME]),
    el('p', { class: 'auth-brand__sub' }, ['Family Data Collection'])
  ]));
  form.appendChild(el('label', { class: 'field-label', for: 'login-name' }, ['Volunteer Name']));
  form.appendChild(nameInput);
  form.appendChild(el('label', { class: 'field-label', for: 'login-pin' }, ['PIN']));
  form.appendChild(pinInput);
  form.appendChild(errorBox);
  form.appendChild(el('button', { class: 'btn btn--primary btn--block btn--large', type: 'submit' }, ['Login']));

  root.appendChild(form);
  nameInput.focus();

  async function handleSubmit(e) {
    e.preventDefault();
    errorBox.textContent = '';
    const name = nameInput.value.trim();
    const pin = pinInput.value.trim();
    if (!name || !pin) {
      errorBox.textContent = 'Please enter both your name and PIN.';
      return;
    }
    if (!isValidPin(pin)) {
      errorBox.textContent = 'PIN should be numeric (4-10 digits).';
      return;
    }
    const submitBtn = qs('button[type="submit"]', form);
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in…';
    try {
      const result = await apiCall('login', { name, pin, device: navigator.userAgent });
      setSession(result.token, result.volunteer);
      toast(`Welcome, ${result.volunteer.name}!`, 'success');
      navigate('#/dashboard');
    } catch (err) {
      errorBox.textContent = err.message || 'Login failed. Please try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Login';
    }
  }
}

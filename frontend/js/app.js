/**
 * app.js
 * Application bootstrap: registers routes, builds the top nav, wires the
 * offline outbox flush, and registers the service worker.
 */

import { registerRoute, startRouter, navigate } from './router.js';
import { renderLogin, logout, currentVolunteer, isLoggedIn } from './auth.js';
import { renderDashboard } from './dashboard.js';
import { renderFamilyList } from './familyList.js';
import { renderSearch } from './search.js';
import { renderWizard } from './wizard.js';
import { renderAdmin } from './admin.js';
import { flushOutbox } from './api.js';
import { toast, el } from './utils.js';
import { CONFIG } from './config.js';

registerRoute('/login', renderLogin);
registerRoute('/dashboard', renderDashboard, { requiresAuth: true });
registerRoute('/families', renderFamilyList, { requiresAuth: true });
registerRoute('/search', renderSearch, { requiresAuth: true });
registerRoute('/wizard', renderWizard, { requiresAuth: true });
registerRoute('/admin', renderAdmin, { requiresAuth: true, requiresAdmin: true });
registerRoute('/notfound', (root) => { root.innerHTML = '<div class="empty-state">Page not found.</div>'; });

function buildNav() {
  const nav = document.getElementById('app-nav');
  nav.innerHTML = '';
  const v = currentVolunteer();
  const links = [
    { hash: '#/dashboard', label: 'Home', icon: '🏠' },
    { hash: '#/families', label: 'Families', icon: '📋' },
    { hash: '#/search', label: 'Search', icon: '🔍' }
  ];
  if (v && v.role === 'Admin') {
    links.push({ hash: '#/admin', label: 'Admin', icon: '⚙️' });
  }

  links.forEach(link => {
    const a = el('a', {
      href: link.hash,
      class: 'nav-link' + (location.hash === link.hash ? ' nav-link--active' : '')
    }, [el('span', { class: 'nav-link__icon' }, [link.icon]), el('span', {}, [link.label])]);
    nav.appendChild(a);
  });

  const logoutBtn = el('a', {
    href: '#',
    class: 'nav-link nav-link--logout',
    onclick: (e) => { e.preventDefault(); logout(navigate); }
  }, [el('span', { class: 'nav-link__icon' }, ['↩']), el('span', {}, ['Logout'])]);
  nav.appendChild(logoutBtn);
}

window.addEventListener('hashchange', buildNav);
window.addEventListener('DOMContentLoaded', () => {
  document.title = CONFIG.APP_NAME;
  buildNav();
  startRouter();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      // Non-fatal: app still works online without the service worker.
    });
  }

  attemptOutboxFlush();
  window.addEventListener('online', attemptOutboxFlush);
});

function attemptOutboxFlush() {
  if (!isLoggedIn()) return;
  flushOutbox(({ ok }) => {
    if (ok) toast('A saved family that was offline has been synced.', 'success');
  }).catch(() => {});
}

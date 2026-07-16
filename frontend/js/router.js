/**
 * router.js
 * Minimal hash-based router. Routes are registered with a render function
 * receiving (root, navigate, params). Auth/role guarding happens here so
 * every view module can assume it only renders when allowed.
 */

import { isLoggedIn, currentVolunteer } from './auth.js';
import { toast } from './utils.js';

const routes = {};

export function registerRoute(path, renderFn, options) {
  routes[path] = { renderFn, options: options || {} };
}

export function navigate(hash) {
  if (location.hash === hash) {
    renderCurrent();
  } else {
    location.hash = hash;
  }
}

function parseHash() {
  const hash = location.hash || '#/login';
  const [pathPart, queryPart] = hash.slice(1).split('?');
  const path = pathPart || '/login';
  const params = {};
  if (queryPart) {
    new URLSearchParams(queryPart).forEach((v, k) => { params[k] = v; });
  }
  return { path, params };
}

function renderCurrent() {
  const { path, params } = parseHash();
  const root = document.getElementById('app-root');
  const route = routes[path] || routes['/notfound'];

  if (!route) return;

  if (route.options.requiresAuth && !isLoggedIn()) {
    toast('Please log in to continue.', 'warning');
    location.hash = '#/login';
    return;
  }
  if (route.options.requiresAdmin) {
    const v = currentVolunteer();
    if (!v || v.role !== 'Admin') {
      toast('Admin access required.', 'error');
      location.hash = '#/dashboard';
      return;
    }
  }
  if (path === '/login' && isLoggedIn()) {
    location.hash = '#/dashboard';
    return;
  }

  document.getElementById('app-nav').style.display = (path === '/login') ? 'none' : '';
  root.scrollTo(0, 0);
  route.renderFn(root, navigate, params);
}

export function startRouter() {
  window.addEventListener('hashchange', renderCurrent);
  renderCurrent();
}

/**
 * dashboard.js
 * Post-login home screen: stat cards, recent families, primary actions.
 */

import { apiCall } from './api.js';
import { currentVolunteer, logout } from './auth.js';
import { el, statusBadgeClass, toast } from './utils.js';

export async function renderDashboard(root, navigate) {
  const v = currentVolunteer();
  root.innerHTML = '';

  root.appendChild(el('div', { class: 'page-header' }, [
    el('h1', {}, [`Welcome, ${v.name}`]),
    el('p', { class: 'page-subtitle' }, ['Here’s your collection progress'])
  ]));

  const cardsWrap = el('div', { class: 'stat-grid', id: 'stat-grid' }, [
    statCardSkeleton('Collected', '✅'),
    statCardSkeleton('Pending', '🏠'),
    statCardSkeleton('Total Members', '👪'),
    statCardSkeleton('Today’s Collection', '📅')
  ]);
  root.appendChild(cardsWrap);

  const actions = el('div', { class: 'action-grid' }, [
    el('button', { class: 'btn btn--primary btn--large btn--block', onclick: () => navigate('#/wizard') }, ['➕ Add New Family']),
    el('button', { class: 'btn btn--secondary btn--large btn--block', onclick: () => navigate('#/search') }, ['🔍 Search Family']),
    el('button', { class: 'btn btn--ghost btn--large btn--block', onclick: () => logout(navigate) }, ['↩ Logout'])
  ]);
  root.appendChild(actions);

  root.appendChild(el('h2', { class: 'section-title' }, ['Recent Families']));
  const recentList = el('div', { class: 'family-list', id: 'recent-list' }, [
    el('div', { class: 'skeleton-row' }), el('div', { class: 'skeleton-row' })
  ]);
  root.appendChild(recentList);

  try {
    const stats = await apiCall('getDashboard', {});
    renderStats(cardsWrap, stats);
    renderRecent(recentList, stats.recent, navigate);
  } catch (err) {
    toast(err.message || 'Could not load dashboard.', 'error');
  }
}

function statCardSkeleton(label, icon) {
  return el('div', { class: 'stat-card' }, [
    el('div', { class: 'stat-card__icon' }, [icon]),
    el('div', { class: 'stat-card__value' }, ['…']),
    el('div', { class: 'stat-card__label' }, [label])
  ]);
}

function renderStats(cardsWrap, stats) {
  const values = [stats.collected, stats.pending, stats.totalMembers, stats.todayCount];
  Array.from(cardsWrap.children).forEach((card, i) => {
    card.querySelector('.stat-card__value').textContent = values[i];
  });
}

function renderRecent(container, recent, navigate) {
  container.innerHTML = '';
  if (!recent || !recent.length) {
    container.appendChild(el('div', { class: 'empty-state' }, ['No families collected yet. Tap "Add New Family" to get started.']));
    return;
  }
  recent.forEach(f => {
    const item = el('div', {
      class: 'family-card',
      onclick: () => navigate(`#/wizard?id=${encodeURIComponent(f.familyId)}`)
    }, [
      el('div', { class: 'family-card__main' }, [
        el('div', { class: 'family-card__title' }, [f.familyName || '(Unnamed family)']),
        el('div', { class: 'family-card__meta' }, [`Family ID ${f.houseNumber || '-'}`])
      ]),
      el('div', { class: 'family-card__side' }, [
        el('span', { class: statusBadgeClass(f.status) }, [f.status]),
        el('div', { class: 'family-card__date' }, [f.updatedDate || ''])
      ])
    ]);
    container.appendChild(item);
  });
}

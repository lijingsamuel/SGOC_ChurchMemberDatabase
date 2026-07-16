/**
 * search.js
 * Dedicated search screen — family name, house number, phone, member name,
 * family ID, volunteer, or blood group (matching is handled server-side).
 */

import { apiCall } from './api.js';
import { el, statusBadgeClass, toast, debounce } from './utils.js';

export function renderSearch(root, navigate) {
  root.innerHTML = '';
  root.appendChild(el('div', { class: 'page-header' }, [
    el('h1', {}, ['Search Family']),
    el('p', { class: 'page-subtitle' }, ['By name, house no., phone, member name, family ID, or blood group'])
  ]));

  const input = el('input', {
    class: 'input input--search-hero', type: 'search',
    placeholder: 'Start typing to search…', autofocus: 'autofocus'
  });
  root.appendChild(el('div', { class: 'search-bar' }, [input]));

  const resultsEl = el('div', { class: 'family-list' });
  root.appendChild(resultsEl);

  const doSearch = debounce(async () => {
    const term = input.value.trim();
    if (!term) { resultsEl.innerHTML = ''; return; }
    resultsEl.innerHTML = '<div class="skeleton-row"></div>';
    try {
      const results = await apiCall('getFamilies', { filter: 'All', search: term });
      renderResults(resultsEl, results, navigate);
    } catch (err) {
      toast(err.message || 'Search failed.', 'error');
    }
  }, 300);

  input.addEventListener('input', doSearch);
  input.focus();
}

function renderResults(container, families, navigate) {
  container.innerHTML = '';
  if (!families.length) {
    container.appendChild(el('div', { class: 'empty-state' }, ['No matches found.']));
    return;
  }
  families.forEach(f => {
    const item = el('div', {
      class: 'family-card',
      onclick: () => navigate(`#/wizard?id=${encodeURIComponent(f.familyId)}`)
    }, [
      el('div', { class: 'family-card__main' }, [
        el('div', { class: 'family-card__title' }, [f.familyName || `Family ID ${f.houseNumber}`]),
        el('div', { class: 'family-card__meta' }, [`Family ID: ${f.familyId || '-'} • ${f.phone || 'No phone'}`])
      ]),
      el('div', { class: 'family-card__side' }, [
        el('span', { class: statusBadgeClass(f.status) }, [f.status])
      ])
    ]);
    container.appendChild(item);
  });
}

/**
 * familyList.js
 * Assigned family list with status filter + quick search.
 */

import { apiCall } from './api.js';
import { el, statusBadgeClass, toast, debounce } from './utils.js';

const FILTERS = ['All', 'Completed', 'Pending', 'Draft'];

export async function renderFamilyList(root, navigate) {
  root.innerHTML = '';
  let currentFilter = 'All';
  let currentSearch = '';

  root.appendChild(el('div', { class: 'page-header' }, [
    el('h1', {}, ['Families']),
    el('p', { class: 'page-subtitle' }, ['Your assigned houses and submissions'])
  ]));

  const searchBox = el('input', {
    class: 'input', type: 'search', placeholder: 'Search name, house no., phone…'
  });
  root.appendChild(el('div', { class: 'search-bar' }, [searchBox]));

  const filterBar = el('div', { class: 'filter-bar' });
  FILTERS.forEach(f => {
    const chip = el('button', {
      class: 'chip' + (f === currentFilter ? ' chip--active' : ''),
      onclick: () => { currentFilter = f; refresh(); }
    }, [f]);
    chip.dataset.filter = f;
    filterBar.appendChild(chip);
  });
  root.appendChild(filterBar);

  root.appendChild(el('button', {
    class: 'fab', title: 'Add New Family', onclick: () => navigate('#/wizard')
  }, ['+']));

  const listEl = el('div', { class: 'family-list' }, [el('div', { class: 'skeleton-row' })]);
  root.appendChild(listEl);

  searchBox.addEventListener('input', debounce(() => {
    currentSearch = searchBox.value.trim();
    refresh();
  }, 300));

  async function refresh() {
    qsaChips(filterBar).forEach(c => c.classList.toggle('chip--active', c.dataset.filter === currentFilter));
    listEl.innerHTML = '<div class="skeleton-row"></div>';
    try {
      const families = await apiCall('getFamilies', { filter: currentFilter, search: currentSearch });
      renderList(listEl, families, navigate);
    } catch (err) {
      toast(err.message || 'Could not load families.', 'error');
      listEl.innerHTML = '';
      listEl.appendChild(el('div', { class: 'empty-state' }, ['Failed to load. Pull to refresh or check your connection.']));
    }
  }

  refresh();
}

function qsaChips(container) { return Array.from(container.querySelectorAll('.chip')); }

function renderList(container, families, navigate) {
  container.innerHTML = '';
  if (!families.length) {
    container.appendChild(el('div', { class: 'empty-state' }, ['No families match this view.']));
    return;
  }
  families.forEach(f => {
    const item = el('div', {
      class: 'family-card',
      onclick: () => navigate(`#/wizard?id=${encodeURIComponent(f.familyId)}`)
    }, [
      el('div', { class: 'family-card__main' }, [
        el('div', { class: 'family-card__title' }, [f.familyName || `House ${f.houseNumber}`]),
        el('div', { class: 'family-card__meta' }, [`House ${f.houseNumber || '-'} • ${f.ward || ''} ${f.area ? '• ' + f.area : ''}`])
      ]),
      el('div', { class: 'family-card__side' }, [
        el('span', { class: statusBadgeClass(f.status) }, [f.status]),
        el('div', { class: 'family-card__date' }, [f.updatedDate || 'Not started'])
      ])
    ]);
    container.appendChild(item);
  });
}

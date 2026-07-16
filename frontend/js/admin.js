/**
 * admin.js
 * Admin dashboard: stats, volunteer-wise/blood-group/age charts, birthday &
 * anniversary lists, full family list with edit/delete, CSV export, audit log.
 * Charts are drawn with plain <canvas> — no external chart library needed.
 */

import { apiCall } from './api.js';
import { el, toast, confirmDialog, statusBadgeClass, toCsv, downloadFile } from './utils.js';

const TABS = ['Overview', 'Families', 'Reports', 'Audit Log'];

export async function renderAdmin(root, navigate) {
  root.innerHTML = '';
  root.appendChild(el('div', { class: 'page-header' }, [
    el('h1', {}, ['Admin']),
    el('p', { class: 'page-subtitle' }, ['Full visibility across all volunteers'])
  ]));

  let activeTab = 'Overview';
  const tabBar = el('div', { class: 'filter-bar' });
  const content = el('div', { class: 'admin-content' });

  TABS.forEach(tab => {
    const chip = el('button', {
      class: 'chip' + (tab === activeTab ? ' chip--active' : ''),
      onclick: () => { activeTab = tab; renderTabs(); loadTab(); }
    }, [tab]);
    chip.dataset.tab = tab;
    tabBar.appendChild(chip);
  });

  root.appendChild(tabBar);
  root.appendChild(content);

  function renderTabs() {
    Array.from(tabBar.children).forEach(c => c.classList.toggle('chip--active', c.dataset.tab === activeTab));
  }

  async function loadTab() {
    content.innerHTML = '<div class="skeleton-row"></div>';
    try {
      if (activeTab === 'Overview') await renderOverview(content);
      else if (activeTab === 'Families') await renderFamiliesTab(content, navigate);
      else if (activeTab === 'Reports') await renderReportsTab(content);
      else if (activeTab === 'Audit Log') await renderAuditTab(content);
    } catch (err) {
      content.innerHTML = '';
      content.appendChild(el('div', { class: 'empty-state' }, [err.message || 'Failed to load.']));
    }
  }

  loadTab();
}

async function renderOverview(content) {
  const reports = await apiCall('getReports', {});
  content.innerHTML = '';

  const t = reports.totals;
  content.appendChild(el('div', { class: 'stat-grid' }, [
    statCard('👪', t.families, 'Total Families'),
    statCard('✅', t.completed, 'Completed'),
    statCard('🏠', t.pending, 'Pending'),
    statCard('📝', t.draft, 'Draft'),
    statCard('🧑‍🤝‍🧑', t.members, 'Total Members')
  ]));

  content.appendChild(el('h2', { class: 'section-title' }, ['Volunteer-wise Collection']));
  content.appendChild(barChart(
    reports.volunteerWise.map(v => ({ label: v.volunteer, value: v.completed })),
    '#0057B8'
  ));

  content.appendChild(el('h2', { class: 'section-title' }, ['Blood Group Summary']));
  content.appendChild(barChart(
    Object.entries(reports.bloodGroupSummary).map(([label, value]) => ({ label, value })),
    '#FF9800'
  ));

  content.appendChild(el('h2', { class: 'section-title' }, ['Age Distribution']));
  content.appendChild(barChart(
    Object.entries(reports.ageDistribution).map(([label, value]) => ({ label, value })),
    '#00A86B'
  ));
}

function statCard(icon, value, label) {
  return el('div', { class: 'stat-card' }, [
    el('div', { class: 'stat-card__icon' }, [icon]),
    el('div', { class: 'stat-card__value' }, [String(value)]),
    el('div', { class: 'stat-card__label' }, [label])
  ]);
}

function barChart(data, color) {
  const wrap = el('div', { class: 'chart-wrap' });
  if (!data.length) {
    wrap.appendChild(el('div', { class: 'empty-state' }, ['No data yet.']));
    return wrap;
  }
  const max = Math.max(1, ...data.map(d => d.value));
  const barHeight = 28;
  const gap = 10;
  const labelWidth = 90;
  const chartWidth = 260;
  const canvas = el('canvas', {
    width: String(labelWidth + chartWidth + 50),
    height: String(data.length * (barHeight + gap) + gap)
  });
  wrap.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  ctx.font = '13px Inter, sans-serif';
  ctx.textBaseline = 'middle';

  data.forEach((d, i) => {
    const y = gap + i * (barHeight + gap);
    ctx.fillStyle = isDark ? '#e6e6e6' : '#1a1a1a';
    ctx.textAlign = 'right';
    ctx.fillText(truncate(d.label, 14), labelWidth - 8, y + barHeight / 2);

    const w = Math.max(2, (d.value / max) * chartWidth);
    ctx.fillStyle = color;
    roundRect(ctx, labelWidth, y, w, barHeight, 6);
    ctx.fill();

    ctx.fillStyle = isDark ? '#e6e6e6' : '#1a1a1a';
    ctx.textAlign = 'left';
    ctx.fillText(String(d.value), labelWidth + w + 8, y + barHeight / 2);
  });

  return wrap;
}

function truncate(s, n) { return (s && s.length > n) ? s.slice(0, n - 1) + '…' : (s || ''); }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function renderFamiliesTab(content, navigate) {
  content.innerHTML = '';
  const searchBox = el('input', { class: 'input', type: 'search', placeholder: 'Search all families…' });
  content.appendChild(el('div', { class: 'search-bar' }, [searchBox]));
  const listEl = el('div', { class: 'family-list' });
  content.appendChild(listEl);

  let searchTimer;
  searchBox.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => load(searchBox.value.trim()), 300);
  });

  async function load(search) {
    listEl.innerHTML = '<div class="skeleton-row"></div>';
    const families = await apiCall('getFamilies', { filter: 'All', search: search || '' });
    listEl.innerHTML = '';
    if (!families.length) {
      listEl.appendChild(el('div', { class: 'empty-state' }, ['No families found.']));
      return;
    }
    families.forEach(f => {
      listEl.appendChild(el('div', { class: 'family-card' }, [
        el('div', { class: 'family-card__main', onclick: () => navigate(`#/wizard?id=${encodeURIComponent(f.familyId)}`) }, [
          el('div', { class: 'family-card__title' }, [f.familyName || `Family ID ${f.familyId}`]),
          el('div', { class: 'family-card__meta' }, [`Family ID ${f.familyId || '-'} • ${f.volunteer || 'Unassigned'}`])
        ]),
        el('div', { class: 'family-card__side' }, [
          el('span', { class: statusBadgeClass(f.status) }, [f.status]),
          el('button', {
            class: 'icon-btn icon-btn--danger', title: 'Delete',
            onclick: async (e) => {
              e.stopPropagation();
              const ok = await confirmDialog({
                title: 'Delete this family?',
                message: `${f.familyName || 'This record'} and all its members will be permanently deleted.`,
                confirmLabel: 'Delete', danger: true
              });
              if (!ok) return;
              try {
                await apiCall('deleteFamily', { familyId: f.familyId });
                toast('Family deleted.', 'success');
                load(searchBox.value.trim());
              } catch (err) {
                toast(err.message || 'Delete failed.', 'error');
              }
            }
          }, ['🗑'])
        ])
      ]));
    });
  }

  load('');
}

async function renderReportsTab(content) {
  const reports = await apiCall('getReports', {});
  content.innerHTML = '';

  content.appendChild(el('div', { class: 'action-grid' }, [
    el('button', { class: 'btn btn--primary btn--block', onclick: exportCsv }, ['⬇ Export CSV / Excel']),
    el('button', { class: 'btn btn--secondary btn--block', onclick: exportPdf }, ['🖨 Export PDF (Print)'])
  ]));

  content.appendChild(el('h2', { class: 'section-title' }, ['Upcoming Birthdays (30 days)']));
  content.appendChild(dateList(reports.birthdays, '🎂'));

  content.appendChild(el('h2', { class: 'section-title' }, ['Upcoming Wedding Anniversaries (30 days)']));
  content.appendChild(dateList(reports.anniversaries, '💍'));
}

function dateList(items, icon) {
  if (!items.length) return el('div', { class: 'empty-state' }, ['None in the next 30 days.']);
  const list = el('div', { class: 'family-list' });
  items.forEach(i => {
    list.appendChild(el('div', { class: 'family-card' }, [
      el('div', { class: 'family-card__main' }, [
        el('div', { class: 'family-card__title' }, [`${icon} ${i.name}`]),
        el('div', { class: 'family-card__meta' }, [`${i.familyId} • ${i.date}`])
      ]),
      el('div', { class: 'family-card__side' }, [
        el('span', { class: 'badge badge--pending' }, [i.daysAway === 0 ? 'Today' : `in ${i.daysAway}d`])
      ])
    ]));
  });
  return list;
}

async function exportCsv() {
  try {
    const data = await apiCall('getFullExport', {});
    const csv = toCsv(data.rows);
    downloadFile('church-families-export.csv', csv, 'text/csv');
    toast('Export downloaded. Opens directly in Excel/Sheets.', 'success');
  } catch (err) {
    toast(err.message || 'Export failed.', 'error');
  }
}

async function exportPdf() {
  try {
    const data = await apiCall('getFullExport', {});
    const win = window.open('', '_blank');
    const rows = data.rows.map(r => `<tr>${Object.values(r).map(v => `<td>${v ?? ''}</td>`).join('')}</tr>`).join('');
    const headers = data.rows.length ? Object.keys(data.rows[0]).map(h => `<th>${h}</th>`).join('') : '';
    win.document.write(`
      <html><head><title>Church Family Export</title>
      <style>
        body{font-family:Inter,Arial,sans-serif;font-size:11px;}
        table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;}
        th{background:#0057B8;color:#fff;}
      </style></head><body>
      <h2>Church Family Data Export</h2>
      <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  } catch (err) {
    toast(err.message || 'Export failed.', 'error');
  }
}

async function renderAuditTab(content) {
  const rows = await apiCall('getAuditLog', {});
  content.innerHTML = '';
  if (!rows.length) {
    content.appendChild(el('div', { class: 'empty-state' }, ['No activity recorded yet.']));
    return;
  }
  const list = el('div', { class: 'family-list' });
  rows.forEach(r => {
    list.appendChild(el('div', { class: 'family-card' }, [
      el('div', { class: 'family-card__main' }, [
        el('div', { class: 'family-card__title' }, [`${r.action} ${r.familyId ? '— ' + r.familyId : ''}`]),
        el('div', { class: 'family-card__meta' }, [`${r.volunteer} • ${r.timestamp}`])
      ])
    ]));
  });
  content.appendChild(list);
}

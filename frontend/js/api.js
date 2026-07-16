/**
 * api.js
 * Thin wrapper around the Apps Script backend. Uses a text/plain POST body so
 * the request stays a CORS "simple request" (Apps Script has no doOptions
 * handler, so a JSON content-type would trigger a preflight and fail).
 *
 * saveFamily calls are queued in IndexedDB automatically when offline, and
 * flushed as soon as connectivity returns (see flushOutbox / app.js).
 */

import { CONFIG } from './config.js';
import { Outbox } from './db.js';

function getToken() {
  return localStorage.getItem('cf_token') || '';
}

export function getSession() {
  const raw = localStorage.getItem('cf_volunteer');
  return raw ? JSON.parse(raw) : null;
}

export function setSession(token, volunteer) {
  localStorage.setItem('cf_token', token);
  localStorage.setItem('cf_volunteer', JSON.stringify(volunteer));
}

export function clearSession() {
  localStorage.removeItem('cf_token');
  localStorage.removeItem('cf_volunteer');
}

async function rawCall(action, data) {
  const payload = { action, token: getToken(), data: data || {} };
  const res = await fetch(CONFIG.SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Network error (' + res.status + ')');
  const json = await res.json();
  if (!json.ok) {
    const err = new Error(json.error || 'Request failed');
    err.code = json.code;
    throw err;
  }
  return json.result;
}

/**
 * Calls a backend action. For 'saveFamily', a network failure queues the
 * request for later instead of throwing, so volunteers never lose data while
 * out of signal range at a house visit.
 */
export async function apiCall(action, data, opts) {
  opts = opts || {};
  try {
    return await rawCall(action, data);
  } catch (err) {
    const isNetworkError = err instanceof TypeError || err.message === 'Failed to fetch';
    if (isNetworkError && action === 'saveFamily' && !opts.noQueue) {
      await Outbox.enqueue({ action, data });
      const queuedErr = new Error('OFFLINE_QUEUED');
      queuedErr.code = 'OFFLINE_QUEUED';
      throw queuedErr;
    }
    throw err;
  }
}

/** Replays any queued saveFamily requests. Call on load and on 'online'. */
export async function flushOutbox(onEach) {
  const items = await Outbox.getAll();
  for (const item of items) {
    try {
      const result = await rawCall(item.action, item.data);
      await Outbox.remove(item.localId);
      if (onEach) onEach({ ok: true, item, result });
    } catch (err) {
      // Still offline or still failing — leave it queued and stop for now.
      if (onEach) onEach({ ok: false, item, error: err });
      break;
    }
  }
}

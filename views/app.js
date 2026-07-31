/**
 * views/app.js
 * Shared fetch-API helper used by login.html, dashboard.html, admin.html.
 */
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('cb_token');
}
function setSession(token, user) {
  localStorage.setItem('cb_token', token);
  localStorage.setItem('cb_user', JSON.stringify(user));
}
function getUser() {
  const raw = localStorage.getItem('cb_user');
  return raw ? JSON.parse(raw) : null;
}
function clearSession() {
  localStorage.removeItem('cb_token');
  localStorage.removeItem('cb_user');
}
function requireLogin() {
  if (!getToken()) window.location.href = '/views/login.html';
}
function logout() {
  clearSession();
  window.location.href = '/views/login.html';
}

async function api(path, { method = 'GET', body = null, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isForm && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch (e) { /* no body, e.g. 204 */ }

  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

/** Badge color -> Tailwind classes */
function badgeClasses(color) {
  switch (color) {
    case 'RED': return 'bg-red-100 text-red-800 border border-red-300';
    case 'ORANGE': return 'bg-orange-100 text-orange-800 border border-orange-300';
    default: return 'bg-green-100 text-green-800 border border-green-300';
  }
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

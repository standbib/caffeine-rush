// Caffeine Rush — leaderboard module.
// Loaded as an ES module so we can pull the Supabase JS SDK from a CDN
// without a build step. Exposes a small global API on window.cgLeaderboard
// so the existing classic-script game.js can talk to it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ─────────────────────────────────────────────────────────────────────────
// Config — replace with real values after Supabase project is created.
// Both values are safe to commit publicly: the anon key is designed for
// client-side use; row-level security (see schema.sql) is what protects data.
// ─────────────────────────────────────────────────────────────────────────

const SUPABASE_URL      = 'https://mtlgtastkrnstllshwon.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_I4hUtZIYs0GJ3wY0fpacFg_PhPK6abP';

const TOP_N = 10;
const NAME_STORAGE_KEY = 'cgLastName';

const isConfigured =
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_ANON_KEY.length > 40;

const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// Track the last submitted score row ID so we can highlight "you" in the list.
let lastSubmittedId = null;

// ─────────────────────────────────────────────────────────────────────────
// Data layer
// ─────────────────────────────────────────────────────────────────────────

async function fetchTopScores(limit = TOP_N) {
  if (!supabase) return { data: [], notConfigured: true };
  const { data, error } = await supabase
    .from('scores')
    .select('id, name, score, level_reached, created_at')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) return { error };
  return { data };
}

async function submitScore({ name, score, level }) {
  if (!supabase) return { notConfigured: true };

  const cleanName = String(name || '').trim().slice(0, 20);
  if (!cleanName) return { error: { message: 'Name required' } };

  const safeScore = Math.max(0, Math.min(50000, Math.floor(Number(score) || 0)));
  const safeLevel = Math.max(1, Math.min(3, Math.floor(Number(level) || 1)));

  const { data, error } = await supabase
    .from('scores')
    .insert({ name: cleanName, score: safeScore, level_reached: safeLevel })
    .select('id')
    .single();
  if (error) return { error };

  lastSubmittedId = data.id;
  try { localStorage.setItem(NAME_STORAGE_KEY, cleanName); } catch (_) {}
  return { data };
}

// ─────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────

const listEl   = document.getElementById('cg-leaderboard');
const refreshBtn = document.getElementById('cg-lb-refresh');
const submitForm = document.getElementById('cg-submit-form');
const nameInput  = document.getElementById('cg-name-input');
const submitBtn  = document.getElementById('cg-submit-btn');
const statusEl   = document.getElementById('cg-submit-status');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderEmpty(message = 'No scores yet — be the first.') {
  listEl.innerHTML = `<li class="leaderboard-empty">${escapeHtml(message)}</li>`;
}

function renderError(message = "Couldn't load the leaderboard.") {
  listEl.innerHTML = `<li class="leaderboard-error">${escapeHtml(message)}</li>`;
}

function renderRows(rows) {
  if (!rows || rows.length === 0) { renderEmpty(); return; }
  listEl.innerHTML = rows.map((row, i) => {
    const rank = i + 1;
    const isYou = lastSubmittedId !== null && row.id === lastSubmittedId;
    const cls = [
      i === 0 ? 'top1' : '',
      isYou ? 'you' : '',
    ].filter(Boolean).join(' ');
    return `
      <li class="${cls}">
        <span class="leaderboard-rank">#${rank}</span>
        <span class="leaderboard-name">${escapeHtml(row.name)}</span>
        <span class="leaderboard-level">L${row.level_reached}</span>
        <span class="leaderboard-score">${row.score.toLocaleString()}</span>
      </li>`;
  }).join('');
}

async function refresh() {
  if (!isConfigured) { renderEmpty('Leaderboard coming soon.'); return; }
  if (refreshBtn) refreshBtn.disabled = true;
  try {
    const { data, error, notConfigured } = await fetchTopScores();
    if (notConfigured) { renderEmpty('Leaderboard coming soon.'); return; }
    if (error) { renderError(); return; }
    renderRows(data);
    // Keep the in-modal mini list in sync with the main board.
    if (data) renderMiniFromRows(data.slice(0, 3));
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Mini leaderboard inside the game-over overlay
// ─────────────────────────────────────────────────────────────────────────

const miniListEl = document.getElementById('cg-leaderboard-mini-list');
const miniWrapEl = document.getElementById('cg-leaderboard-mini');

function renderMiniFromRows(rows) {
  if (!miniListEl) return;
  if (!rows || rows.length === 0) {
    miniListEl.innerHTML = '<li class="leaderboard-mini-empty">No scores yet — be the first.</li>';
    return;
  }
  miniListEl.innerHTML = rows.map((row, i) => `
    <li>
      <span class="lm-rank">#${i + 1}</span>
      <span class="lm-name">${escapeHtml(row.name)}</span>
      <span class="lm-score">${row.score.toLocaleString()}</span>
    </li>`).join('');
}

async function renderMini() {
  if (!isConfigured) {
    if (miniWrapEl) miniWrapEl.classList.add('hidden');
    return;
  }
  if (miniWrapEl) miniWrapEl.classList.remove('hidden');
  if (miniListEl) miniListEl.innerHTML = '<li class="leaderboard-mini-empty">Loading…</li>';
  const { data, error } = await fetchTopScores(3);
  if (error || !data) {
    if (miniListEl) miniListEl.innerHTML = '<li class="leaderboard-mini-empty">Couldn\'t load.</li>';
    return;
  }
  renderMiniFromRows(data);
}

// ─────────────────────────────────────────────────────────────────────────
// Game-over submit form
// ─────────────────────────────────────────────────────────────────────────

function setStatus(message, kind = '') {
  statusEl.textContent = message || '';
  statusEl.classList.remove('success', 'error');
  if (kind) statusEl.classList.add(kind);
}

function showSubmitForm() {
  if (!isConfigured) {
    submitForm.classList.add('hidden');
    setStatus('');
    return;
  }
  submitForm.classList.remove('hidden');
  submitBtn.disabled = false;
  submitBtn.textContent = 'Submit score';
  setStatus('');
  try {
    const last = localStorage.getItem(NAME_STORAGE_KEY);
    if (last && !nameInput.value) nameInput.value = last;
  } catch (_) {}
}

submitForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isConfigured) return;

  const score = Number(document.getElementById('cg-final').textContent) || 0;
  const level = Number(document.getElementById('cg-final-level').textContent) || 1;
  const name = nameInput.value;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';
  setStatus('');

  const { data, error, notConfigured } = await submitScore({ name, score, level });

  if (notConfigured) {
    setStatus('Leaderboard not enabled yet.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit score';
    return;
  }
  if (error) {
    setStatus(error.message || 'Submit failed — try again.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit score';
    return;
  }

  setStatus('Saved. Check the leaderboard below.', 'success');
  submitForm.classList.add('hidden');
  refresh();
});

if (refreshBtn) {
  refreshBtn.addEventListener('click', () => refresh());
}

// ─────────────────────────────────────────────────────────────────────────
// Public API for game.js
// ─────────────────────────────────────────────────────────────────────────

window.cgLeaderboard = {
  refresh,
  renderMini,
  showSubmitForm,
  isConfigured,
};

// Initial fetch
refresh();

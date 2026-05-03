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

function detectPlatform() {
  try {
    return window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop';
  } catch (_) {
    return null;
  }
}

// ─── Profanity filter ─────────────────────────────────────────────────
// Two-tier wordlist:
//   LOOSE stems → any word starting with this is flagged (catches
//   inflections like "fucker", "shitting"). Used for unambiguous slurs.
//   STRICT stems → only exact word or simple plural matches. Used for
//   short stems that frequently appear inside innocent words (e.g.
//   "spec/spice" near "spic", "Cracker Barrel" near "cracker").
//
// Pre-normalization strips spaces/punctuation and applies common leet
// substitutions (1→i, 0→o, @→a, $→s, 3→e, 4→a, 5→s, 7→t) so trolls
// can't bypass with "f u c k" or "f@gg0t".
//
// Client-side layer for instant UX feedback. A CHECK constraint on the
// scores table is the server-side backstop — DevTools bypass still gets
// rejected by Postgres.
const PROFANITY_RE = new RegExp([
  // Loose stems: \b{stem}\w* — matches the stem and any longer word starting with it
  '\\b(?:' + [
    'f+u*c+k+',          // fuck, fck, f*ck (after star is stripped), fuuck
    'sh+i+t+', 'b+i+t+c+h+',
    'cunt', 'asshole', 'bastard', 'dickhead', 'pussy', 'twat', 'wanker',
    'fagg?ot', 'retard', 'tranny', 'raghead', 'jiggaboo',
    'rape', 'rapist',    // rape/rapist/rapes/raping
    'pedophile', 'molest', 'cuck',
    'n+i+g+(?:er|a|uh)+',
  ].join('|') + ')\\w*',
  // Strict stems: \b{stem}\b — exact word (with simple plural) only
  '\\b(?:' + [
    'whores?', 'sluts?', 'slutty',
    'fags?', 'kikes?', 'spics?', 'chinks?', 'gooks?',
    'japs?', 'wops?', 'krauts?', 'pakis?',
    'crackers?', 'beaners?', 'redskins?', 'coons?',
    'heil', 'sieg', 'kys', 'pedos?',
    'kill\\s*yo?urself',
  ].join('|') + ')\\b',
].join('|'), 'i');

function containsProfanity(name) {
  // Lowercase + leet substitutions, but preserve word boundaries for
  // accurate matching. Strip whitespace and common separator punctuation
  // so "f.u.c.k" and "f u c k" don't slip through.
  const normalized = String(name).toLowerCase()
    .replace(/[\s._\-,'"!?*]/g, '')
    .replace(/0/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't');
  return PROFANITY_RE.test(normalized);
}

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

async function fetchTopScores(limit = TOP_N, filter = 'all') {
  if (!supabase) return { data: [], notConfigured: true };
  let query = supabase
    .from('scores')
    .select('id, name, score, level_reached, platform, created_at');
  if (filter === 'mobile' || filter === 'desktop') {
    query = query.eq('platform', filter);
  } else if (filter === 'today') {
    // "Today" is local-midnight to local-now. Convert to ISO for the
    // Supabase timestamptz comparison.
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    query = query.gte('created_at', start.toISOString());
  }
  const { data, error } = await query
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) return { error };
  return { data };
}

async function submitScore({ name, score, level, drinks }) {
  if (!supabase) return { notConfigured: true };

  const cleanName = String(name || '').trim().slice(0, 20);
  if (!cleanName) return { error: { message: 'Name required' } };
  if (containsProfanity(cleanName)) {
    return { error: { message: 'Please pick a different name.' } };
  }

  const safeScore = Math.max(0, Math.min(50000, Math.floor(Number(score) || 0)));
  const safeLevel = Math.max(1, Math.min(3, Math.floor(Number(level) || 1)));
  // Drinks bounded so a single absurd value can't dominate the global counter.
  const safeDrinks = Math.max(0, Math.min(500, Math.floor(Number(drinks) || 0)));
  const platform = detectPlatform();

  const { data, error } = await supabase
    .from('scores')
    .insert({
      name: cleanName,
      score: safeScore,
      level_reached: safeLevel,
      drinks: safeDrinks,
      platform: platform,
    })
    .select('id')
    .single();
  if (error) return { error };

  lastSubmittedId = data.id;
  try { localStorage.setItem(NAME_STORAGE_KEY, cleanName); } catch (_) {}
  return { data };
}

// Total coffees-refilled counter — sum across all rows.
async function fetchTotalDrinks() {
  if (!supabase) return { notConfigured: true, total: 0 };
  // Postgres: sum() returns null for empty tables, so coalesce to 0.
  // Using rpc-less approach: select drinks across all rows, sum client-side.
  // For ~hundreds-of-rows scale this is fine; if it grows large we can move
  // to a Postgres function or a materialized counter row.
  const { data, error } = await supabase
    .from('scores')
    .select('drinks');
  if (error) return { error, total: 0 };
  const total = (data || []).reduce((acc, r) => acc + (r.drinks || 0), 0);
  return { total };
}

// ─────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────

const listEl   = document.getElementById('cg-leaderboard');
const refreshBtn = document.getElementById('cg-lb-refresh');
const filterEls  = Array.from(document.querySelectorAll('.lb-filter-btn'));
const submitForm = document.getElementById('cg-submit-form');
const nameInput  = document.getElementById('cg-name-input');
const submitBtn  = document.getElementById('cg-submit-btn');
const statusEl   = document.getElementById('cg-submit-status');

let currentFilter = 'all';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderEmpty(message) {
  if (!message) {
    if (currentFilter === 'today')        message = 'No scores today yet — be the first.';
    else if (currentFilter === 'mobile')  message = 'No mobile scores yet.';
    else if (currentFilter === 'desktop') message = 'No desktop scores yet.';
    else                                  message = 'No scores yet — be the first.';
  }
  listEl.innerHTML = `<li class="leaderboard-empty">${escapeHtml(message)}</li>`;
}

function renderError(message = "Couldn't load the leaderboard.") {
  listEl.innerHTML = `<li class="leaderboard-error">${escapeHtml(message)}</li>`;
}

// SVG glyphs are universally readable. No legend needed.
const PHONE_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="5" y="2" width="6" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><line x1="7" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const MONITOR_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="2" y="3" width="12" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><line x1="8" y1="11" x2="8" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="5" y1="14" x2="11" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

function platformPip(platform) {
  if (platform === 'mobile')  return '<span class="leaderboard-platform pf-m" title="Mobile">'  + PHONE_ICON   + '</span>';
  if (platform === 'desktop') return '<span class="leaderboard-platform pf-d" title="Desktop">' + MONITOR_ICON + '</span>';
  return '<span class="leaderboard-platform pf-unknown" title="Unknown"></span>';
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
        ${platformPip(row.platform)}
        <span class="leaderboard-score">${row.score.toLocaleString()}</span>
      </li>`;
  }).join('');
}

async function refresh() {
  if (!isConfigured) { renderEmpty('Leaderboard coming soon.'); return; }
  if (refreshBtn) refreshBtn.disabled = true;
  try {
    const { data, error, notConfigured } = await fetchTopScores(TOP_N, currentFilter);
    if (notConfigured) { renderEmpty('Leaderboard coming soon.'); return; }
    if (error) { renderError(); return; }
    renderRows(data);
    // Mini list in the game-over overlay always shows the all-time top 3,
    // not the filtered view — fetch separately if filter is active.
    if (currentFilter === 'all' && data) {
      renderMiniFromRows(data.slice(0, 3));
    }
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
  }
}

function setFilter(next) {
  if (next === currentFilter) return;
  currentFilter = next;
  filterEls.forEach(btn => {
    const active = btn.dataset.filter === next;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  refresh();
}

filterEls.forEach(btn => {
  btn.addEventListener('click', () => setFilter(btn.dataset.filter));
});

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
      ${platformPip(row.platform)}
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
  // Drinks come straight from the in-memory state set by game.js.
  const drinks = Number((window.cgGameState && window.cgGameState.drinks) || 0);
  const name = nameInput.value;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';
  setStatus('');

  const { data, error, notConfigured } = await submitScore({ name, score, level, drinks });

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
  fetchTotalDrinks,
};

// Initial fetch
refresh();

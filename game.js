(function(){
  const NS = 'http://www.w3.org/2000/svg';
  const DOCK_Y = 268, SPAWN_Y = 20, ORIGIN_X = 340, ORIGIN_Y = 368;

  // Base level config — Day 1 baseline. Day 2+ runs the same levels with
  // tighter spawn rates, faster travel, longer adenosine sticky, and
  // shorter caffeine half-life. levelConfigForDay() applies the multipliers.
  //
  // travelMs replaces the old fixed 4133ms travel time. Slower travel +
  // wider sticky window made Level 1 unloseable by inactivity; tightening
  // both turns it into a real "use it or lose it" opening level.
  const BASE_LEVELS = [
    { positions: [100, 260, 420, 580],            spawnStart: 1500, spawnEnd: 900, halfLife: 8000, sticky: 8000, durationMs: 30000, travelMs: 1600, name: 'Morning' },
    { positions: [110, 240, 370, 500, 630],       spawnStart: 1100, spawnEnd: 700, halfLife: 7000, sticky: 7000, durationMs: 30000, travelMs: 1300, name: 'Afternoon slump' },
    { positions: [70, 180, 290, 400, 510, 620],   spawnStart: 800,  spawnEnd: 500, halfLife: 6000, sticky: 6000, durationMs: 45000, travelMs: 1100, name: 'Late night' },
  ];

  function levelConfigForDay(baseIdx, day) {
    const base = BASE_LEVELS[baseIdx];
    const d = Math.max(1, day);
    const spawnMul    = 1 / Math.pow(1.10, d - 1);
    const travelMul   = 1 / Math.pow(1.05, d - 1);
    const stickyMul   = Math.pow(1.05, d - 1);
    const halfLifeMul = 1 / Math.pow(1.05, d - 1);
    return {
      positions:  base.positions,
      spawnStart: base.spawnStart * spawnMul,
      spawnEnd:   base.spawnEnd   * spawnMul,
      halfLife:   base.halfLife   * halfLifeMul,
      sticky:     base.sticky     * stickyMul,
      durationMs: base.durationMs,
      travelMs:   base.travelMs   * travelMul,
      baseName:   base.name,
      day:        d,
    };
  }

  function currentLevel() {
    return levelConfigForDay(state.levelIdx, state.day);
  }

  const FACTS = [
    "Caffeine has a half-life of about 5 hours. Half of your noon coffee is still in you at 5pm.",
    "Adenosine doesn't make you tired — it just signals neurons to slow down. Caffeine blocks the messenger.",
    "Espresso has less caffeine per shot than drip coffee per cup, but more per ounce.",
    "It takes about 20 minutes for caffeine to start working.",
    "Tolerance builds because your brain grows MORE adenosine receptors to compensate.",
    "A 'cup' in caffeine science is 8oz. Most coffee cups today are 12–20oz.",
    "Decaf isn't caffeine-free — it has 2–15mg per cup vs. 80–100mg for regular.",
    "Cold brew has more caffeine than hot drip because of longer steeping time.",
  ];
  const INTERMISSION_MS = 5000;
  const COOLDOWN_RING_CIRCUMFERENCE = 56.55; // 2 * pi * 9

  // Telegraph: faint dashed guide line drawn from spawn X down to the
  // target receptor BEFORE the adenosine itself appears. Gives the
  // player reaction time to pre-position caffeine. The window between
  // telegraph appearing and adenosine docking is TELEGRAPH_LEAD_MS +
  // travelMs (e.g. 700 + 1600 = 2300ms on Day 1 Level 1).
  const TELEGRAPH_LEAD_MS = 700;
  const TELEGRAPH_FADE_IN_MS = 200;

  const state = {
    score: 0, caffeine: 5, caffeineMax: 8,
    drinkCooldown: 0, drinkCooldownMax: 8000,
    clickCooldown: 0, clickCooldownMax: 400,
    receptors: [], adenosines: [], pendingCaffeine: [],
    telegraphs: [],
    adenosineNextSpawn: 2000,
    level: 1, levelIdx: 0, levelStartTime: 0,
    alertnessTimer: 0, alertnessFailMs: 5000,
    gameTime: 0, gameOver: false,
    rafId: null, lastFrameTime: 0,
    intermission: false, intermissionStart: 0, intermissionNextIdx: 0, intermissionNextDay: 1,
    intermissionTimerId: null,
    usedFacts: [],
    day: 1,
    welcomeOpen: false,
    tooltipOpen: false,
  };

  // ─── Personal best (localStorage, browser-local) ────────────────────
  const PB_KEY = 'cgPersonalBest';

  function getPersonalBest() {
    try { return JSON.parse(localStorage.getItem(PB_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function savePersonalBestIfNew(score, day, level) {
    const cur = getPersonalBest();
    if (cur && score <= cur.score) return false;
    try {
      localStorage.setItem(PB_KEY, JSON.stringify({
        score: score, day: day, level: level, at: Date.now(),
      }));
    } catch (_) { /* private mode etc — silent */ }
    return true;
  }

  function renderPersonalBest(isNewBest) {
    const wrap = document.getElementById('cg-personal-best');
    if (!wrap) return;
    const best = getPersonalBest();
    if (!best) { wrap.hidden = true; return; }

    const labelEl = document.getElementById('cg-pb-label');
    const scoreEl = document.getElementById('cg-pb-score');
    const metaEl  = document.getElementById('cg-pb-meta');

    if (labelEl) labelEl.textContent = isNewBest ? 'New personal best' : 'Your best';
    if (scoreEl) scoreEl.textContent = best.score.toLocaleString();
    if (metaEl)  metaEl.textContent  = (best.day > 1 ? 'Day ' + best.day + ' · ' : '') + 'Level ' + best.level;

    wrap.classList.toggle('is-new', !!isNewBest);
    wrap.hidden = false;
  }

  function pickFact() {
    if (state.usedFacts.length >= FACTS.length) state.usedFacts = [];
    let idx;
    do { idx = Math.floor(Math.random() * FACTS.length); } while (state.usedFacts.indexOf(idx) !== -1);
    state.usedFacts.push(idx);
    return FACTS[idx];
  }

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function drawAdenosine(parent, scale) {
    const s = scale || 1;
    const g = el('g', null, parent);
    el('circle', { r: (14 * s).toFixed(1), fill: '#7F77DD' }, g);
    el('path', { d: 'M -7 -3 Q -4 -1 -1 -3', stroke: '#26215C', 'stroke-width': '1.4', fill: 'none', 'stroke-linecap': 'round', transform: 'scale(' + s + ')' }, g);
    el('path', { d: 'M 1 -3 Q 4 -1 7 -3', stroke: '#26215C', 'stroke-width': '1.4', fill: 'none', 'stroke-linecap': 'round', transform: 'scale(' + s + ')' }, g);
    el('ellipse', { cx: '0', cy: (5 * s).toFixed(1), rx: (2 * s).toFixed(1), ry: (1.5 * s).toFixed(1), fill: '#26215C' }, g);
    return g;
  }

  function drawCaffeine(parent, scale) {
    const s = scale || 1;
    const g = el('g', null, parent);
    el('circle', { r: (13 * s).toFixed(1), fill: '#D85A30' }, g);
    el('circle', { cx: (-4 * s).toFixed(1), cy: (-2 * s).toFixed(1), r: (1.5 * s).toFixed(1), fill: '#4A1B0C' }, g);
    el('circle', { cx: (4 * s).toFixed(1), cy: (-2 * s).toFixed(1), r: (1.5 * s).toFixed(1), fill: '#4A1B0C' }, g);
    el('path', { d: 'M -3 5 Q 0 7 3 5', stroke: '#4A1B0C', 'stroke-width': '1.4', fill: 'none', 'stroke-linecap': 'round', transform: 'scale(' + s + ')' }, g);
    return g;
  }

  function buildBackground() {
    const layer = document.getElementById('cg-bg-particles');
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    for (let i = 0; i < 24; i++) {
      const x = 20 + Math.random() * 640;
      const y = 50 + Math.random() * 240;
      const r = 1 + Math.random() * 2.2;
      const purple = Math.random() > 0.32;
      el('circle', {
        cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(1),
        fill: purple ? '#7F77DD' : '#D85A30',
        opacity: (0.07 + Math.random() * 0.11).toFixed(2),
        class: 'bg-drift-' + ((i % 4) + 1),
      }, layer);
    }
    const memb = document.getElementById('cg-membrane-deco');
    while (memb.firstChild) memb.removeChild(memb.firstChild);
    for (let x = 12; x < 680; x += 26) {
      el('circle', { cx: x, cy: 305, r: 2.2, fill: '#73726c' }, memb);
      el('line', { x1: x, y1: 307, x2: x, y2: 318, stroke: '#73726c', 'stroke-width': '0.6' }, memb);
      el('circle', { cx: x, cy: 345, r: 2.2, fill: '#73726c' }, memb);
      el('line', { x1: x, y1: 343, x2: x, y2: 332, stroke: '#73726c', 'stroke-width': '0.6' }, memb);
    }
  }

  function buildReceptor(idx, x) {
    const g = el('g', { class: 'receptor entering', 'data-receptor': idx, 'data-status': 'empty', transform: 'translate(' + x + ',260)' });
    el('rect', { x: '-32', y: '-12', width: '64', height: '62', fill: 'transparent' }, g);
    el('path', { class: 'receptor-arm', d: 'M -22 42 L -22 8 Q -22 0 -14 0 L -12 0 L -12 42 Z', fill: 'var(--color-background-primary)', stroke: 'var(--color-border-secondary)', 'stroke-width': '0.5' }, g);
    el('path', { class: 'receptor-arm', d: 'M 12 42 L 12 0 L 14 0 Q 22 0 22 8 L 22 42 Z', fill: 'var(--color-background-primary)', stroke: 'var(--color-border-secondary)', 'stroke-width': '0.5' }, g);
    el('rect', { x: '-22', y: '38', width: '44', height: '4', rx: '1', fill: 'var(--color-background-primary)', stroke: 'var(--color-border-secondary)', 'stroke-width': '0.5' }, g);
    const cBound = el('g', { class: 'bound-caffeine', transform: 'translate(0,8)' }, g);
    drawCaffeine(cBound, 1);
    const aBound = el('g', { class: 'bound-adenosine', transform: 'translate(0,8)' }, g);
    drawAdenosine(aBound, 1);
    g.addEventListener('click', () => clickReceptor(idx));
    return g;
  }

  function rebuildReceptors() {
    const lvl = currentLevel();
    const old = state.receptors;
    state.receptors = lvl.positions.map((x, i) => ({
      x: x,
      status: old[i] ? old[i].status : 'empty',
      timer: old[i] ? old[i].timer : 0,
    }));
    const layer = document.getElementById('cg-receptors');
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    state.receptors.forEach((r, i) => {
      const g = buildReceptor(i, r.x);
      g.dataset.status = r.status;
      layer.appendChild(g);
    });
  }

  function getSpawnInterval() {
    const lvl = currentLevel();
    const elapsed = state.gameTime - state.levelStartTime;
    const t = Math.min(elapsed / Math.min(lvl.durationMs, 30000), 1);
    return lvl.spawnStart + (lvl.spawnEnd - lvl.spawnStart) * t;
  }

  function maybeAdvanceLevel() {
    if (state.intermission || state.gameOver) return;
    const lvl = currentLevel();
    const elapsed = state.gameTime - state.levelStartTime;
    if (elapsed < lvl.durationMs) return;

    // Wrap past the last level → next day starts at Level 1.
    let nextIdx = state.levelIdx + 1;
    let nextDay = state.day;
    if (nextIdx >= BASE_LEVELS.length) {
      nextIdx = 0;
      nextDay = state.day + 1;
    }
    enterIntermission(nextIdx, nextDay);
  }

  function enterIntermission(nextIdx, nextDay) {
    state.intermission = true;
    state.intermissionStart = performance.now();
    state.intermissionNextIdx = nextIdx;
    state.intermissionNextDay = nextDay;

    const fact = pickFact();
    const nextConfig = levelConfigForDay(nextIdx, nextDay);
    const lvlEl  = document.getElementById('cg-int-level');
    const nameEl = document.getElementById('cg-int-name');
    const factEl = document.getElementById('cg-int-fact');
    const overlay = document.getElementById('cg-intermission');
    const timerFill = document.getElementById('cg-int-timer-fill');

    if (lvlEl) {
      lvlEl.textContent = 'Level ' + (nextIdx + 1) +
        (nextDay > 1 ? ' · Day ' + nextDay : '');
    }
    if (nameEl) nameEl.textContent = nextConfig.baseName;
    if (factEl) factEl.textContent = fact;
    if (timerFill) timerFill.style.width = '100%';
    if (overlay) overlay.classList.add('show');

    if (state.intermissionTimerId) clearTimeout(state.intermissionTimerId);
    state.intermissionTimerId = setTimeout(exitIntermission, INTERMISSION_MS);
  }

  function exitIntermission() {
    if (!state.intermission) return;
    if (state.intermissionTimerId) {
      clearTimeout(state.intermissionTimerId);
      state.intermissionTimerId = null;
    }
    const nextIdx = state.intermissionNextIdx;
    const nextDay = state.intermissionNextDay;
    state.intermission = false;
    state.levelIdx = nextIdx;
    state.level = nextIdx + 1;
    state.day = nextDay;
    state.levelStartTime = state.gameTime;
    state.adenosineNextSpawn = state.gameTime + 800; // brief grace period after intermission

    // Fresh slate for the new level. Clear receptor state, any in-flight
    // molecules, and the alertness countdown so a bad spot at the end of
    // the previous level doesn't carry over into the new one. Score, level
    // number, day, and the caffeine mug all persist.
    state.receptors = [];
    state.adenosines = [];
    state.pendingCaffeine = [];
    state.telegraphs = [];
    state.alertnessTimer = 0;

    document.getElementById('cg-level').textContent = state.level;
    const dayEl = document.getElementById('cg-day');
    if (dayEl) dayEl.textContent = state.day;
    document.getElementById('cg-intermission').classList.remove('show');
    applyLevelTheme();
    rebuildReceptors();
    const lvl = currentLevel();
    showBanner(
      'Level ' + state.level + (state.day > 1 ? ' · Day ' + state.day : ''),
      lvl.baseName
    );
  }

  // Time-of-day theming: swap a background class on the playfield SVG so
  // levels feel like morning → afternoon → late night.
  function applyLevelTheme() {
    const pf = document.getElementById('cg-playfield');
    if (!pf) return;
    pf.classList.remove('level-morning', 'level-afternoon', 'level-night');
    if (state.levelIdx === 0)      pf.classList.add('level-morning');
    else if (state.levelIdx === 1) pf.classList.add('level-afternoon');
    else                            pf.classList.add('level-night');
  }

  function updateIntermissionTimer() {
    const fill = document.getElementById('cg-int-timer-fill');
    if (!fill) return;
    const elapsed = performance.now() - state.intermissionStart;
    const remaining = Math.max(0, INTERMISSION_MS - elapsed);
    const pct = (remaining / INTERMISSION_MS) * 100;
    fill.style.width = pct.toFixed(1) + '%';
  }

  function showBanner(title, sub) {
    const b = document.getElementById('cg-banner');
    b.innerHTML = title + (sub ? '<span class="cgame-banner-sub">' + sub + '</span>' : '');
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), 1700);
  }

  function scheduleTelegraph() {
    if (!state.receptors.length) return;
    const targetIdx = Math.floor(Math.random() * state.receptors.length);
    const target = state.receptors[targetIdx];
    const startX = Math.max(20, Math.min(660, target.x + (Math.random() - 0.5) * 100));
    state.telegraphs.push({
      x: startX, targetX: target.x, target: targetIdx,
      age: 0, leadMs: TELEGRAPH_LEAD_MS, dead: false,
    });
  }

  function spawnAdenosineFromTelegraph(t) {
    const target = state.receptors[t.target];
    if (!target) return; // receptor count changed (level boundary edge case)
    const travelMs = currentLevel().travelMs;
    state.adenosines.push({
      origX: t.x, origY: SPAWN_Y, targetX: target.x, targetY: DOCK_Y,
      x: t.x, y: SPAWN_Y, travelMs: travelMs, elapsed: 0, target: t.target, dead: false,
    });
  }

  function clickReceptor(idx) {
    // First click after dismissing the welcome modal: hide the tooltip
    // and let the rest of the click logic run normally so the very same
    // tap also docks caffeine — no wasted "tutorial click".
    if (state.tooltipOpen) dismissTooltip();
    if (state.gameOver || state.clickCooldown > 0 || state.caffeine <= 0) return;
    const r = state.receptors[idx];
    if (!r || r.status !== 'empty') return;
    state.caffeine--;
    state.clickCooldown = state.clickCooldownMax;
    r.status = 'pending';
    state.pendingCaffeine.push({
      target: idx, origX: ORIGIN_X, origY: ORIGIN_Y,
      targetX: r.x, targetY: DOCK_Y,
      progress: 0, elapsed: 0, travelMs: 400, dead: false,
    });
  }

  function drink() {
    if (state.drinkCooldown > 0 || state.gameOver) return;
    state.caffeine = state.caffeineMax;
    state.drinkCooldown = state.drinkCooldownMax;
  }
  window.cgDrink = drink;

  function endGame() {
    state.gameOver = true;
    if (state.intermissionTimerId) {
      clearTimeout(state.intermissionTimerId);
      state.intermissionTimerId = null;
    }
    state.intermission = false;
    document.getElementById('cg-overlay').classList.add('show');
    document.getElementById('cg-intermission').classList.remove('show');
    const finalScore = Math.floor(state.score);
    document.getElementById('cg-final').textContent = finalScore;
    document.getElementById('cg-final-level').textContent = state.level;
    const finalDayEl = document.getElementById('cg-final-day');
    const dayWrapEl  = document.getElementById('cg-final-day-wrap');
    if (finalDayEl) finalDayEl.textContent = state.day;
    if (dayWrapEl)  dayWrapEl.hidden = state.day <= 1;

    const isNewBest = savePersonalBestIfNew(finalScore, state.day, state.level);
    renderPersonalBest(isNewBest);
    document.getElementById('cg-playfield').classList.remove('danger');
    document.getElementById('cg-warn').classList.remove('show');
    if (window.cgLeaderboard && typeof window.cgLeaderboard.showSubmitForm === 'function') {
      window.cgLeaderboard.showSubmitForm();
    }
    if (window.cgLeaderboard && typeof window.cgLeaderboard.renderMini === 'function') {
      window.cgLeaderboard.renderMini();
    }
  }

  function reset() {
    if (state.intermissionTimerId) {
      clearTimeout(state.intermissionTimerId);
    }
    Object.assign(state, {
      score: 0, caffeine: 5, drinkCooldown: 0, clickCooldown: 0,
      adenosines: [], pendingCaffeine: [], telegraphs: [], adenosineNextSpawn: 2000,
      level: 1, levelIdx: 0, levelStartTime: 0,
      alertnessTimer: 0, gameTime: 0, gameOver: false, lastFrameTime: 0,
      receptors: [],
      intermission: false, intermissionStart: 0, intermissionNextIdx: 0, intermissionNextDay: 1,
      intermissionTimerId: null,
      day: 1,
      tooltipOpen: false,
    });
    const tip = document.getElementById('cg-tooltip');
    if (tip) tip.hidden = true;
    const pf  = document.getElementById('cg-playfield');
    if (pf) pf.classList.remove('tooltip-mode');
    document.getElementById('cg-level').textContent = '1';
    const dayEl = document.getElementById('cg-day');
    if (dayEl) dayEl.textContent = '1';
    document.getElementById('cg-overlay').classList.remove('show');
    document.getElementById('cg-intermission').classList.remove('show');
    const pbWrap = document.getElementById('cg-personal-best');
    if (pbWrap) pbWrap.classList.remove('is-new'); // drop celebration tint after restart
    applyLevelTheme();
    rebuildReceptors();
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = requestAnimationFrame(tick);
  }
  window.cgReset = reset;

  function tick(t) {
    if (state.gameOver) return;

    // Welcome modal or first-play tooltip is up: don't advance the
    // simulation. Adenosines must not spawn while the user is reading or
    // figuring out where to tap. Keep RAF alive so gameplay resumes the
    // instant they engage.
    if (state.welcomeOpen || state.tooltipOpen) {
      state.rafId = requestAnimationFrame(tick);
      return;
    }

    // Inter-level intermission: keep the RAF loop alive to drive the timer
    // bar, but freeze gameplay (no dt accumulation, no spawns, no decay).
    if (state.intermission) {
      state.lastFrameTime = t;
      updateIntermissionTimer();
      state.rafId = requestAnimationFrame(tick);
      return;
    }

    const dt = state.lastFrameTime ? Math.min(t - state.lastFrameTime, 50) : 16;
    state.lastFrameTime = t;
    state.gameTime += dt;

    maybeAdvanceLevel();
    if (state.intermission) {
      // maybeAdvanceLevel just entered intermission this frame — bail out
      state.rafId = requestAnimationFrame(tick);
      return;
    }

    state.adenosines.forEach(a => {
      a.elapsed += dt;
      const p = Math.min(a.elapsed / a.travelMs, 1);
      a.x = a.origX + (a.targetX - a.origX) * p;
      a.y = a.origY + (a.targetY - a.origY) * p;
      if (p >= 1) {
        const target = state.receptors[a.target];
        if (target && (target.status === 'empty' || target.status === 'pending')) {
          target.status = 'adenosine';
          target.timer = currentLevel().sticky;
        }
        a.dead = true;
      }
    });
    state.adenosines = state.adenosines.filter(a => !a.dead);

    state.pendingCaffeine.forEach(c => {
      c.elapsed += dt;
      c.progress = Math.min(c.elapsed / c.travelMs, 1);
      if (c.progress >= 1) {
        const target = state.receptors[c.target];
        if (target && target.status === 'pending') {
          target.status = 'caffeine';
          target.timer = currentLevel().halfLife;
        }
        c.dead = true;
      }
    });
    state.pendingCaffeine = state.pendingCaffeine.filter(c => !c.dead);

    state.receptors.forEach(r => {
      if (r.status === 'caffeine' || r.status === 'adenosine') {
        r.timer -= dt;
        if (r.timer <= 0) r.status = 'empty';
      }
    });

    state.score += (state.receptors.filter(r => r.status === 'caffeine').length * dt) / 1000;

    if (state.drinkCooldown > 0) state.drinkCooldown = Math.max(0, state.drinkCooldown - dt);
    if (state.clickCooldown > 0) state.clickCooldown = Math.max(0, state.clickCooldown - dt);

    state.telegraphs.forEach(tg => {
      tg.age += dt;
      if (tg.age >= tg.leadMs) {
        spawnAdenosineFromTelegraph(tg);
        tg.dead = true;
      }
    });
    state.telegraphs = state.telegraphs.filter(tg => !tg.dead);

    if (state.gameTime >= state.adenosineNextSpawn) {
      scheduleTelegraph();
      state.adenosineNextSpawn = state.gameTime + getSpawnInterval();
    }

    const blockedCount = state.receptors.filter(r => r.status === 'adenosine').length;
    const blockedPct = state.receptors.length ? blockedCount / state.receptors.length : 0;
    if (blockedPct > 0.5) {
      state.alertnessTimer += dt;
      if (state.alertnessTimer >= state.alertnessFailMs) { endGame(); render(); return; }
    } else {
      state.alertnessTimer = Math.max(0, state.alertnessTimer - dt * 0.5);
    }

    render();
    state.rafId = requestAnimationFrame(tick);
  }

  function render() {
    state.receptors.forEach((r, i) => {
      const e = document.querySelector('[data-receptor="' + i + '"]');
      if (!e) return;
      e.dataset.status = r.status;
      if (r.status === 'caffeine' && r.timer < 2000) e.classList.add('expiring');
      else e.classList.remove('expiring');
    });

    const tL = document.getElementById('cg-telegraph-layer');
    if (tL) {
      while (tL.firstChild) tL.removeChild(tL.firstChild);
      state.telegraphs.forEach(tg => {
        // Fade in over the first TELEGRAPH_FADE_IN_MS, hold steady after.
        const fadeP = Math.min(tg.age / TELEGRAPH_FADE_IN_MS, 1);
        const opacity = (0.42 * fadeP).toFixed(3);
        el('line', {
          x1: tg.x.toFixed(1), y1: SPAWN_Y,
          x2: tg.targetX.toFixed(1), y2: DOCK_Y,
          class: 'cgame-telegraph',
          opacity: opacity,
        }, tL);
      });
    }

    const aL = document.getElementById('cg-adenosine-layer');
    while (aL.firstChild) aL.removeChild(aL.firstChild);
    state.adenosines.forEach(a => {
      const g = el('g', { transform: 'translate(' + a.x.toFixed(1) + ',' + a.y.toFixed(1) + ')' }, aL);
      drawAdenosine(g, 1);
    });

    const cL = document.getElementById('cg-caffeine-layer');
    while (cL.firstChild) cL.removeChild(cL.firstChild);
    state.pendingCaffeine.forEach(c => {
      const x = c.origX + (c.targetX - c.origX) * c.progress;
      const y = c.origY + (c.targetY - c.origY) * c.progress;
      const g = el('g', { transform: 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')' }, cL);
      drawCaffeine(g, 1);
    });

    document.getElementById('cg-score').textContent = Math.floor(state.score);

    const ratio = state.caffeine / state.caffeineMax;
    document.getElementById('cg-mug-liquid').style.transform = 'translateY(' + (20 * (1 - ratio)) + 'px)';
    document.getElementById('cg-mug-count').textContent = state.caffeine + ' / ' + state.caffeineMax;

    document.getElementById('cg-dispenser').setAttribute('opacity', state.clickCooldown > 0 ? '0.25' : '0.9');

    const drinkBtn = document.getElementById('cg-drink');
    if (state.drinkCooldown > 0) {
      drinkBtn.disabled = true;
      drinkBtn.textContent = 'Drink (' + Math.ceil(state.drinkCooldown / 1000) + 's)';
    } else {
      drinkBtn.disabled = false;
      drinkBtn.textContent = 'Drink (refill)';
    }

    const blockedCount = state.receptors.filter(r => r.status === 'adenosine').length;
    const alertness = state.receptors.length ? 1 - (blockedCount / state.receptors.length) : 1;
    const inDanger = alertness < 0.5;
    const remaining = Math.max(0, (state.alertnessFailMs - state.alertnessTimer) / 1000);

    const fill = document.getElementById('cg-bar-fill');
    fill.style.width = Math.round(alertness * 100) + '%';
    fill.classList.remove('low', 'crit');
    if (inDanger) fill.classList.add('crit');
    else if (alertness < 0.75) fill.classList.add('low');

    const stateEl = document.getElementById('cg-state');
    stateEl.classList.remove('drowsy', 'crit');
    let stateText;
    if (inDanger) {
      stateText = 'Sleep in ' + remaining.toFixed(1) + 's';
      stateEl.classList.add('crit');
    } else if (state.alertnessTimer > 100) {
      stateText = 'Recovering';
      stateEl.classList.add('drowsy');
    } else if (alertness < 0.75) {
      stateText = 'Slipping';
      stateEl.classList.add('drowsy');
    } else {
      stateText = 'Alert';
    }
    stateEl.textContent = stateText;

    const playfield = document.getElementById('cg-playfield');
    if (inDanger) playfield.classList.add('danger');
    else playfield.classList.remove('danger');

    const warnEl = document.getElementById('cg-warn');
    if (inDanger) {
      warnEl.textContent = 'Falling asleep in ' + remaining.toFixed(1) + 's';
      warnEl.classList.add('show');
    } else {
      warnEl.classList.remove('show');
    }

    // Cooldown ring around the dispenser. Drains as click cooldown ticks down.
    const ring = document.getElementById('cg-cooldown-ring');
    if (ring) {
      const cdPct = state.clickCooldown / state.clickCooldownMax;
      const offset = (1 - cdPct) * COOLDOWN_RING_CIRCUMFERENCE;
      ring.setAttribute('stroke-dashoffset', offset.toFixed(1));
    }

    // Level countdown bar (hidden on the infinite final level).
    const lvlTimerWrap = document.getElementById('cg-level-timer-wrap');
    const lvlTimerFill = document.getElementById('cg-level-timer');
    if (lvlTimerWrap && lvlTimerFill) {
      const curLvl = currentLevel();
      if (curLvl.durationMs > 1e8) {
        lvlTimerWrap.classList.add('hidden');
      } else {
        lvlTimerWrap.classList.remove('hidden');
        const elapsed = state.gameTime - state.levelStartTime;
        const pct = Math.min(100, Math.max(0, (elapsed / curLvl.durationMs) * 100));
        lvlTimerFill.style.width = pct.toFixed(1) + '%';
      }
    }
  }

  // Welcome modal — shown on first visit only (localStorage flag).
  // While the modal is open, tick() early-returns so adenosines don't
  // start spawning behind the user's back while they read the rules.
  function initWelcomeModal() {
    const overlay = document.getElementById('cg-welcome');
    const cta     = document.getElementById('cg-welcome-cta');
    if (!overlay || !cta) return;

    let seen = false;
    try { seen = localStorage.getItem('cgSeenWelcome') === '1'; } catch (_) {}
    if (!seen) {
      overlay.hidden = false;
      state.welcomeOpen = true;
    }

    cta.addEventListener('click', () => {
      overlay.hidden = true;
      state.welcomeOpen = false;
      // Drop the recorded last-frame time so the first real tick after
      // unpause uses the default 16ms dt instead of jumping forward.
      state.lastFrameTime = 0;
      try { localStorage.setItem('cgSeenWelcome', '1'); } catch (_) {}
      // Hand off to the first-play tooltip — keeps the game paused until
      // the visitor taps a receptor so they don't lose before they
      // understand what they're looking at.
      showTooltip();
    });
  }

  function showTooltip() {
    const tip = document.getElementById('cg-tooltip');
    const playfield = document.getElementById('cg-playfield');
    if (!tip || !playfield) return;
    state.tooltipOpen = true;
    tip.hidden = false;
    playfield.classList.add('tooltip-mode');
  }

  function dismissTooltip() {
    const tip = document.getElementById('cg-tooltip');
    const playfield = document.getElementById('cg-playfield');
    state.tooltipOpen = false;
    if (tip) tip.hidden = true;
    if (playfield) playfield.classList.remove('tooltip-mode');
    state.lastFrameTime = 0; // resume with a fresh 16ms dt
  }

  // Intermission Skip button.
  function initIntermissionControls() {
    const skipBtn = document.getElementById('cg-int-skip');
    if (skipBtn) skipBtn.addEventListener('click', exitIntermission);
  }

  // Share button — chain: Web Share API → clipboard → in-page modal.
  // Every successful path produces visible feedback. No silent failures.
  function initShareButton() {
    const btn = document.getElementById('cg-share-btn');
    if (!btn) return;

    const labelEl = btn.querySelector('span') || btn;
    const flashCopied = (msg) => {
      const orig = labelEl.textContent;
      labelEl.textContent = msg || 'Link copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        labelEl.textContent = orig;
        btn.classList.remove('copied');
      }, 1800);
    };

    function buildPayload() {
      const score = document.getElementById('cg-final').textContent || '0';
      const level = document.getElementById('cg-final-level').textContent || '1';
      const dayEl = document.getElementById('cg-final-day');
      const day   = dayEl ? parseInt(dayEl.textContent || '1', 10) : 1;
      const survived = day > 1 ? ('Day ' + day) : ('Level ' + level);
      const text  = "I scored " + score + " on Caffeine Rush — survived to " + survived + " before falling asleep. Beat my score:";
      const url   = 'https://caffeine.ianstandbridge.com';
      return { text: text, url: url, full: text + ' ' + url };
    }

    btn.addEventListener('click', async () => {
      const p = buildPayload();

      // 1. Web Share API (iOS Safari, Android, recent desktop Chrome/Safari/Edge)
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Caffeine Rush', text: p.text, url: p.url });
          console.debug('[share] used Web Share API');
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') {
            console.debug('[share] user cancelled Web Share sheet');
            return;
          }
          console.debug('[share] Web Share failed, falling through:', e && e.message);
          // any other error → fall through to clipboard
        }
      }

      // 2. Clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(p.full);
          console.debug('[share] copied via Clipboard API');
          flashCopied();
          return;
        } catch (e) {
          console.debug('[share] Clipboard API failed, falling through:', e && e.message);
        }
      }

      // 3. In-page modal with textarea + Copy button
      console.debug('[share] using in-page fallback modal');
      openShareFallbackModal(p.full, flashCopied);
    });
  }

  function openShareFallbackModal(payload, onCopySuccess) {
    const overlay = document.getElementById('cg-share-fallback');
    const ta      = document.getElementById('cg-share-fallback-text');
    const copyBtn = document.getElementById('cg-share-fallback-copy');
    const doneBtn = document.getElementById('cg-share-fallback-done');
    if (!overlay || !ta || !copyBtn || !doneBtn) return;

    ta.value = payload;
    overlay.hidden = false;
    setTimeout(() => { ta.select(); ta.setSelectionRange(0, ta.value.length); }, 50);

    const close = () => { overlay.hidden = true; };
    const copy = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(payload);
        } else {
          ta.select();
          document.execCommand && document.execCommand('copy');
        }
        const orig = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        if (typeof onCopySuccess === 'function') onCopySuccess('Link copied!');
      } catch (_) {
        // user can still select+copy manually
      }
    };

    copyBtn.onclick = copy;
    doneBtn.onclick = close;
  }

  initWelcomeModal();
  initIntermissionControls();
  initShareButton();
  applyLevelTheme();
  buildBackground();
  rebuildReceptors();
  showBanner('Level 1', BASE_LEVELS[0].name);
  render();
  state.rafId = requestAnimationFrame(tick);
})();

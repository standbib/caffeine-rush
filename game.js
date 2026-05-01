(function(){
  const NS = 'http://www.w3.org/2000/svg';
  const DOCK_Y = 268, SPAWN_Y = 20, ORIGIN_X = 340, ORIGIN_Y = 368;

  const LEVELS = [
    { positions: [100, 260, 420, 580], spawnStart: 2500, spawnEnd: 1000, halfLife: 8000, sticky: 8000, durationMs: 30000, name: 'Morning' },
    { positions: [110, 240, 370, 500, 630], spawnStart: 1200, spawnEnd: 700, halfLife: 7000, sticky: 7000, durationMs: 30000, name: 'Afternoon slump' },
    { positions: [70, 180, 290, 400, 510, 620], spawnStart: 800, spawnEnd: 450, halfLife: 6000, sticky: 6000, durationMs: 9e9, name: 'Late night' },
  ];

  const state = {
    score: 0, caffeine: 5, caffeineMax: 8,
    drinkCooldown: 0, drinkCooldownMax: 8000,
    clickCooldown: 0, clickCooldownMax: 400,
    receptors: [], adenosines: [], pendingCaffeine: [],
    adenosineNextSpawn: 2000,
    level: 1, levelIdx: 0, levelStartTime: 0,
    alertnessTimer: 0, alertnessFailMs: 5000,
    gameTime: 0, gameOver: false,
    rafId: null, lastFrameTime: 0,
  };

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
    const lvl = LEVELS[state.levelIdx];
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
    const lvl = LEVELS[state.levelIdx];
    const elapsed = state.gameTime - state.levelStartTime;
    const t = Math.min(elapsed / Math.min(lvl.durationMs, 30000), 1);
    return lvl.spawnStart + (lvl.spawnEnd - lvl.spawnStart) * t;
  }

  function maybeAdvanceLevel() {
    const lvl = LEVELS[state.levelIdx];
    const elapsed = state.gameTime - state.levelStartTime;
    if (state.levelIdx < LEVELS.length - 1 && elapsed >= lvl.durationMs) {
      state.levelIdx++;
      state.level = state.levelIdx + 1;
      state.levelStartTime = state.gameTime;
      document.getElementById('cg-level').textContent = state.level;
      rebuildReceptors();
      showBanner('Level ' + state.level, LEVELS[state.levelIdx].name);
    }
  }

  function showBanner(title, sub) {
    const b = document.getElementById('cg-banner');
    b.innerHTML = title + (sub ? '<span class="cgame-banner-sub">' + sub + '</span>' : '');
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), 1700);
  }

  function spawnAdenosine() {
    const targetIdx = Math.floor(Math.random() * state.receptors.length);
    const target = state.receptors[targetIdx];
    const startX = Math.max(20, Math.min(660, target.x + (Math.random() - 0.5) * 100));
    const travelMs = (DOCK_Y - SPAWN_Y) / 60 * 1000;
    state.adenosines.push({
      origX: startX, origY: SPAWN_Y, targetX: target.x, targetY: DOCK_Y,
      x: startX, y: SPAWN_Y, travelMs: travelMs, elapsed: 0, target: targetIdx, dead: false,
    });
  }

  function clickReceptor(idx) {
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
    document.getElementById('cg-overlay').classList.add('show');
    document.getElementById('cg-final').textContent = Math.floor(state.score);
    document.getElementById('cg-final-level').textContent = state.level;
    document.getElementById('cg-playfield').classList.remove('danger');
    document.getElementById('cg-warn').classList.remove('show');
    if (window.cgLeaderboard && typeof window.cgLeaderboard.showSubmitForm === 'function') {
      window.cgLeaderboard.showSubmitForm();
    }
  }

  function reset() {
    Object.assign(state, {
      score: 0, caffeine: 5, drinkCooldown: 0, clickCooldown: 0,
      adenosines: [], pendingCaffeine: [], adenosineNextSpawn: 2000,
      level: 1, levelIdx: 0, levelStartTime: 0,
      alertnessTimer: 0, gameTime: 0, gameOver: false, lastFrameTime: 0,
      receptors: [],
    });
    document.getElementById('cg-level').textContent = '1';
    document.getElementById('cg-overlay').classList.remove('show');
    rebuildReceptors();
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = requestAnimationFrame(tick);
  }
  window.cgReset = reset;

  function tick(t) {
    if (state.gameOver) return;
    const dt = state.lastFrameTime ? Math.min(t - state.lastFrameTime, 50) : 16;
    state.lastFrameTime = t;
    state.gameTime += dt;

    maybeAdvanceLevel();

    state.adenosines.forEach(a => {
      a.elapsed += dt;
      const p = Math.min(a.elapsed / a.travelMs, 1);
      a.x = a.origX + (a.targetX - a.origX) * p;
      a.y = a.origY + (a.targetY - a.origY) * p;
      if (p >= 1) {
        const target = state.receptors[a.target];
        if (target && (target.status === 'empty' || target.status === 'pending')) {
          target.status = 'adenosine';
          target.timer = LEVELS[state.levelIdx].sticky;
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
          target.timer = LEVELS[state.levelIdx].halfLife;
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

    if (state.gameTime >= state.adenosineNextSpawn) {
      spawnAdenosine();
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
  }

  buildBackground();
  rebuildReceptors();
  showBanner('Level 1', LEVELS[0].name);
  render();
  state.rafId = requestAnimationFrame(tick);
})();

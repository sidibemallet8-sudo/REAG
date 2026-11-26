import {
  CollectibleEntity,
  GeneratedGameArtifact,
  GeneratedLevelLayout,
  HazardEntity,
  ReagGameSpec,
  RectObstacle,
} from '../types/reag';
import { createId, fnv1aHash, seededRandom } from '../utils/deterministic';
import { SpecificationEngine } from './specificationEngine';

function circleIntersectsRect(
  cx: number,
  cy: number,
  cr: number,
  rect: RectObstacle,
  padding = 0
): boolean {
  const closestX = Math.max(rect.x - padding, Math.min(cx, rect.x + rect.width + padding));
  const closestY = Math.max(rect.y - padding, Math.min(cy, rect.y + rect.height + padding));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < cr * cr;
}

function rectsOverlap(a: RectObstacle, b: RectObstacle, margin = 26): boolean {
  return (
    a.x < b.x + b.width + margin &&
    a.x + a.width + margin > b.x &&
    a.y < b.y + b.height + margin &&
    a.y + a.height + margin > b.y
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const GameGenerator = {
  generateLevelLayout(spec: ReagGameSpec): GeneratedLevelLayout {
    const rand = seededRandom(spec.obstacles.layoutSeed + spec.title.length * 31);
    const { width, height } = spec.arena;

    const playerSpawn = {
      x: Math.round(width * 0.14),
      y: Math.round(height * 0.5),
    };

    const obstacles: RectObstacle[] = [];
    let attempts = 0;

    while (obstacles.length < spec.obstacles.count && attempts < 240) {
      attempts += 1;
      const w = Math.round(
        spec.obstacles.minSize + rand() * (spec.obstacles.maxSize - spec.obstacles.minSize)
      );
      const h = Math.round(
        spec.obstacles.minSize + rand() * (spec.obstacles.maxSize - spec.obstacles.minSize)
      );
      const x = Math.round(52 + rand() * (width - w - 104));
      const y = Math.round(48 + rand() * (height - h - 96));

      const candidate: RectObstacle = {
        id: `obs_wall_${obstacles.length + 1}`,
        x,
        y,
        width: w,
        height: h,
      };

      const hitsSpawn = circleIntersectsRect(
        playerSpawn.x,
        playerSpawn.y,
        spec.player.radius + 32,
        candidate
      );
      const overlapsExisting = obstacles.some((existing) => rectsOverlap(existing, candidate, 28));

      if (!hitsSpawn && !overlapsExisting) {
        obstacles.push(candidate);
      }
    }

    const collectibles: CollectibleEntity[] = [];
    attempts = 0;
    while (collectibles.length < spec.collectibles.count && attempts < 500) {
      attempts += 1;
      const r = spec.collectibles.radius;
      const cx = Math.round(36 + rand() * (width - 72));
      const cy = Math.round(36 + rand() * (height - 72));

      const hitsWall = obstacles.some((wall) => circleIntersectsRect(cx, cy, r + 10, wall));
      const nearSpawn =
        Math.hypot(cx - playerSpawn.x, cy - playerSpawn.y) < spec.player.radius + 38;
      const nearOther = collectibles.some((c) => Math.hypot(cx - c.x, cy - c.y) < 34);

      if (!hitsWall && !nearSpawn && !nearOther) {
        collectibles.push({
          id: `col_${collectibles.length + 1}`,
          x: cx,
          y: cy,
          radius: r,
          points: spec.collectibles.pointsPerItem,
          collected: false,
        });
      }
    }

    const hazards: HazardEntity[] = [];
    attempts = 0;
    while (hazards.length < spec.hazards.count && attempts < 300) {
      attempts += 1;
      const r = spec.hazards.radius;
      const hx = Math.round(width * 0.42 + rand() * (width * 0.5 - 32));
      const hy = Math.round(44 + rand() * (height - 88));

      const hitsWall = obstacles.some((wall) => circleIntersectsRect(hx, hy, r + 10, wall));
      const nearSpawn = Math.hypot(hx - playerSpawn.x, hy - playerSpawn.y) < 120;
      const nearOther = hazards.some((h) => Math.hypot(hx - h.x, hy - h.y) < 42);

      if (!hitsWall && !nearSpawn && !nearOther) {
        const angle = (0.35 + rand() * 0.85) * Math.PI * (rand() > 0.5 ? 1 : -1);
        hazards.push({
          id: `haz_${hazards.length + 1}`,
          x: hx,
          y: hy,
          vx: Math.cos(angle) * spec.hazards.speed,
          vy: Math.sin(angle) * spec.hazards.speed,
          radius: r,
          speed: spec.hazards.speed,
          damage: spec.hazards.damage,
          behavior: spec.hazards.behavior,
        });
      }
    }

    return {
      playerSpawn,
      obstacles,
      collectibles,
      hazards,
    };
  },

  buildStandaloneHtml(spec: ReagGameSpec, layout: GeneratedLevelLayout): string {
    const payload = JSON.stringify({ spec, layout });
    const safeTitle = escapeHtml(spec.title);

    return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} — Export REAG V1</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; align-items: center; min-height: 100vh; padding: 16px; }
    .hud { width: 100%; max-width: ${spec.arena.width}px; display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center; padding: 10px 14px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; margin-bottom: 12px; font-size: 14px; }
    .hud strong { font-variant-numeric: tabular-nums; }
    canvas { width: 100%; max-width: ${spec.arena.width}px; height: auto; border: 1px solid #334155; border-radius: 8px; background: ${spec.arena.backgroundColor}; display: block; }
    .controls { margin-top: 12px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; justify-content: center; }
    .dpad { display: grid; grid-template-columns: repeat(3, 46px); grid-template-rows: repeat(2, 46px); gap: 6px; }
    button { cursor: pointer; border: 1px solid #475569; background: #1e293b; color: #f8fafc; border-radius: 8px; font-size: 14px; font-weight: 600; padding: 8px 14px; touch-action: manipulation; }
    button:active, button.primary { background: #2563eb; border-color: #3b82f6; }
  </style>
</head>
<body>
  <div class="hud">
    <span><strong>${safeTitle}</strong></span>
    <span>Score : <strong id="score">0</strong></span>
    <span>${escapeHtml(spec.collectibles.label)} : <strong id="col">0/${layout.collectibles.length}</strong></span>
    <span>Vies : <strong id="lives">${spec.player.initialLives}</strong></span>
    <span id="timer"></span>
    <span id="stateLabel">Prêt</span>
  </div>
  <canvas id="game" width="${spec.arena.width}" height="${spec.arena.height}"></canvas>
  <div class="controls">
    <button id="btnStart" class="primary">Démarrer</button>
    <button id="btnRestart">Redémarrer</button>
    <div class="dpad" aria-label="Pavé directionnel">
      <div></div>
      <button data-dir="up">▲</button>
      <div></div>
      <button data-dir="left">◀</button>
      <button data-dir="down">▼</button>
      <button data-dir="right">▶</button>
    </div>
  </div>
  <script>
    const DATA = ${payload};
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const keys = { up: false, down: false, left: false, right: false };
    let state = null;
    let lastTs = 0;

    function resetState(startPlaying) {
      const { spec, layout } = DATA;
      state = {
        status: startPlaying ? 'PLAYING' : 'PRE_GAME',
        score: 0,
        collected: 0,
        timeLeft: spec.rules.timeLimitSeconds ? spec.rules.timeLimitSeconds * 1000 : null,
        player: { x: layout.playerSpawn.x, y: layout.playerSpawn.y, r: spec.player.radius, lives: spec.player.initialLives, invuln: 0 },
        obstacles: layout.obstacles.map(o => ({ ...o })),
        collectibles: layout.collectibles.map(c => ({ ...c, collected: false })),
        hazards: layout.hazards.map(h => ({ ...h })),
      };
      updateHud();
    }

    function circleRectHit(cx, cy, r, rect) {
      const x = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
      const y = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
      const dx = cx - x, dy = cy - y;
      return dx * dx + dy * dy < r * r;
    }

    function updateHud() {
      document.getElementById('score').textContent = String(state.score);
      document.getElementById('col').textContent = state.collected + '/' + state.collectibles.length;
      document.getElementById('lives').textContent = String(state.player.lives);
      document.getElementById('timer').textContent = state.timeLeft !== null ? 'Temps : ' + Math.ceil(state.timeLeft / 1000) + 's' : '';
      const map = { PRE_GAME: 'Prêt', PLAYING: 'En cours', VICTORY: 'Victoire', DEFEAT: 'Défaite' };
      document.getElementById('stateLabel').textContent = map[state.status] || state.status;
    }

    function step(dtMs) {
      if (state.status !== 'PLAYING') return;
      const dt = Math.min(dtMs, 50) / 1000;
      const spec = DATA.spec;
      if (state.player.invuln > 0) state.player.invuln = Math.max(0, state.player.invuln - dtMs);
      if (state.timeLeft !== null) {
        state.timeLeft = Math.max(0, state.timeLeft - dtMs);
        if (state.timeLeft <= 0) { state.status = 'DEFEAT'; updateHud(); return; }
      }
      let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      let dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (dx !== 0 && dy !== 0) { const inv = 1 / Math.SQRT2; dx *= inv; dy *= inv; }
      const nx = Math.max(state.player.r, Math.min(spec.arena.width - state.player.r, state.player.x + dx * spec.player.speed * dt));
      if (!state.obstacles.some(w => circleRectHit(nx, state.player.y, state.player.r, w))) state.player.x = nx;
      const ny = Math.max(state.player.r, Math.min(spec.arena.height - state.player.r, state.player.y + dy * spec.player.speed * dt));
      if (!state.obstacles.some(w => circleRectHit(state.player.x, ny, state.player.r, w))) state.player.y = ny;

      for (const c of state.collectibles) {
        if (!c.collected && Math.hypot(state.player.x - c.x, state.player.y - c.y) < state.player.r + c.radius) {
          c.collected = true;
          state.collected += 1;
          state.score += c.points;
        }
      }
      if (state.collected >= state.collectibles.length || (spec.rules.winCondition === 'target_score' && state.score >= spec.rules.targetScore)) {
        state.status = 'VICTORY'; updateHud(); return;
      }

      for (const h of state.hazards) {
        const hx = h.x + h.vx * dt;
        if (hx - h.radius < 0 || hx + h.radius > spec.arena.width || state.obstacles.some(w => circleRectHit(hx, h.y, h.radius, w))) {
          h.vx = -h.vx;
        } else { h.x = hx; }
        const hy = h.y + h.vy * dt;
        if (hy - h.radius < 0 || hy + h.radius > spec.arena.height || state.obstacles.some(w => circleRectHit(h.x, hy, h.radius, w))) {
          h.vy = -h.vy;
        } else { h.y = hy; }
        if (state.player.invuln <= 0 && Math.hypot(state.player.x - h.x, state.player.y - h.y) < state.player.r + h.radius) {
          state.player.lives = Math.max(0, state.player.lives - h.damage);
          state.player.invuln = spec.player.invulnerabilityMs;
          if (state.player.lives <= 0) { state.status = 'DEFEAT'; break; }
        }
      }
      updateHud();
    }

    function draw() {
      const spec = DATA.spec;
      ctx.fillStyle = spec.arena.backgroundColor;
      ctx.fillRect(0, 0, spec.arena.width, spec.arena.height);
      ctx.fillStyle = spec.obstacles.color;
      for (const w of state.obstacles) ctx.fillRect(w.x, w.y, w.width, w.height);
      ctx.fillStyle = spec.collectibles.color;
      for (const c of state.collectibles) if (!c.collected) { ctx.beginPath(); ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = spec.hazards.color;
      for (const h of state.hazards) { ctx.beginPath(); ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = state.player.invuln > 0 ? 0.55 : 1;
      ctx.fillStyle = spec.player.color;
      ctx.beginPath(); ctx.arc(state.player.x, state.player.y, state.player.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    function loop(ts) {
      if (!lastTs) lastTs = ts;
      const dt = ts - lastTs;
      lastTs = ts;
      step(dt);
      draw();
      requestAnimationFrame(loop);
    }

    const keyMap = { ArrowUp: 'up', KeyW: 'up', KeyZ: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left', ArrowRight: 'right', KeyD: 'right' };
    window.addEventListener('keydown', (e) => { if (keyMap[e.code]) { e.preventDefault(); keys[keyMap[e.code]] = true; } });
    window.addEventListener('keyup', (e) => { if (keyMap[e.code]) { keys[keyMap[e.code]] = false; } });
    document.querySelectorAll('[data-dir]').forEach((btn) => {
      const dir = btn.getAttribute('data-dir');
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); keys[dir] = true; });
      btn.addEventListener('pointerup', () => { keys[dir] = false; });
      btn.addEventListener('pointerleave', () => { keys[dir] = false; });
    });
    document.getElementById('btnStart').addEventListener('click', () => { if (state.status === 'PRE_GAME') { state.status = 'PLAYING'; updateHud(); } });
    document.getElementById('btnRestart').addEventListener('click', () => resetState(true));
    resetState(false);
    requestAnimationFrame(loop);
  </script>
</body>
</html>`;
  },

  generateGame(spec: ReagGameSpec): GeneratedGameArtifact {
    const validation = SpecificationEngine.validateSpecification(spec);
    if (!validation.valid) {
      throw new Error(`Spécification invalide : ${validation.errors.join(' ')}`);
    }

    const layout = this.generateLevelLayout(spec);
    const standaloneHtml = this.buildStandaloneHtml(spec, layout);
    const checksum = fnv1aHash(JSON.stringify({ spec, layout }));

    return {
      id: createId('art'),
      generatedAt: new Date().toISOString(),
      checksum,
      spec,
      layout,
      standaloneHtml,
    };
  },
};

import {
  GameRuntimeState,
  GeneratedGameArtifact,
  InputVector,
  RectObstacle,
  RuntimeLogEntry,
} from '../types/reag';

function circleRectCollides(cx: number, cy: number, r: number, rect: RectObstacle): boolean {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

function pushEvent(
  events: RuntimeLogEntry[],
  timestampMs: number,
  type: RuntimeLogEntry['type'],
  message: string
): RuntimeLogEntry[] {
  const entry: RuntimeLogEntry = {
    id: `evt_${timestampMs}_${Math.random().toString(36).slice(2, 6)}`,
    timestampMs: Math.round(timestampMs),
    type,
    message,
  };
  return [entry, ...events].slice(0, 24);
}

export interface StepCallbacks {
  onCollect?: () => void;
  onDamage?: () => void;
  onVictory?: () => void;
  onDefeat?: () => void;
}

export function playRuntimeTone(kind: 'collect' | 'damage' | 'victory' | 'defeat', enabled: boolean): void {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (kind === 'collect') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.09);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (kind === 'damage') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.16);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.19);
    } else if (kind === 'victory') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554, now + 0.08);
      osc.frequency.setValueAtTime(659, now + 0.16);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.start(now);
      osc.stop(now + 0.35);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.32);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.36);
    }
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 450);
  } catch {
    // Ignore audio context restrictions
  }
}

export function createRuntimeState(
  artifact: GeneratedGameArtifact,
  autoStart = false
): GameRuntimeState {
  const { spec, layout } = artifact;
  return {
    status: autoStart ? 'PLAYING' : 'PRE_GAME',
    elapsedMs: 0,
    timeRemainingMs:
      spec.rules.timeLimitSeconds !== null ? spec.rules.timeLimitSeconds * 1000 : null,
    score: 0,
    collectedCount: 0,
    totalCollectibles: layout.collectibles.length,
    player: {
      x: layout.playerSpawn.x,
      y: layout.playerSpawn.y,
      vx: 0,
      vy: 0,
      radius: spec.player.radius,
      lives: spec.player.initialLives,
      maxLives: spec.player.initialLives,
      invulnerableRemainingMs: 0,
      facingAngle: 0,
    },
    obstacles: layout.obstacles.map((o) => ({ ...o })),
    collectibles: layout.collectibles.map((c) => ({ ...c, collected: false })),
    hazards: layout.hazards.map((h) => ({ ...h })),
    particles: [],
    events: [
      {
        id: 'evt_init',
        timestampMs: 0,
        type: 'info',
        message: autoStart
          ? 'Partie initialisée et démarrée.'
          : 'Moteur prêt. Lancez la partie pour tester les mécaniques.',
      },
    ],
    spec,
  };
}

export function stepRuntime(
  state: GameRuntimeState,
  input: InputVector,
  dtMs: number,
  callbacks?: StepCallbacks
): GameRuntimeState {
  // Mise à jour des particules même en fin de partie pour un rendu propre
  const clampedDtMs = Math.max(0, Math.min(dtMs, 50));
  const dt = clampedDtMs / 1000;

  const updatedParticles = state.particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      lifeMs: p.lifeMs - clampedDtMs,
    }))
    .filter((p) => p.lifeMs > 0);

  if (state.status !== 'PLAYING') {
    return {
      ...state,
      particles: updatedParticles,
    };
  }

  let events = state.events;
  const elapsedMs = state.elapsedMs + clampedDtMs;
  let timeRemainingMs = state.timeRemainingMs;

  if (timeRemainingMs !== null) {
    timeRemainingMs = Math.max(0, timeRemainingMs - clampedDtMs);
    if (timeRemainingMs <= 0) {
      events = pushEvent(events, elapsedMs, 'fin', 'Temps limite écoulé : défaite.');
      callbacks?.onDefeat?.();
      return {
        ...state,
        status: 'DEFEAT',
        elapsedMs,
        timeRemainingMs: 0,
        particles: updatedParticles,
        events,
      };
    }
  }

  const { spec } = state;
  const player = { ...state.player };
  player.invulnerableRemainingMs = Math.max(0, player.invulnerableRemainingMs - clampedDtMs);

  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (dx !== 0 && dy !== 0) {
    const inv = 1 / Math.SQRT2;
    dx *= inv;
    dy *= inv;
  }

  player.vx = dx * spec.player.speed;
  player.vy = dy * spec.player.speed;
  if (dx !== 0 || dy !== 0) {
    player.facingAngle = Math.atan2(dy, dx);
  }

  // Résolution par axe pour glissement fluide le long des obstacles
  const targetX = Math.max(
    player.radius,
    Math.min(spec.arena.width - player.radius, player.x + player.vx * dt)
  );
  if (!state.obstacles.some((w) => circleRectCollides(targetX, player.y, player.radius, w))) {
    player.x = targetX;
  }

  const targetY = Math.max(
    player.radius,
    Math.min(spec.arena.height - player.radius, player.y + player.vy * dt)
  );
  if (!state.obstacles.some((w) => circleRectCollides(player.x, targetY, player.radius, w))) {
    player.y = targetY;
  }

  // Collecte des objets
  let score = state.score;
  let collectedCount = state.collectedCount;
  const particles = [...updatedParticles];

  const collectibles = state.collectibles.map((item) => {
    if (item.collected) return item;
    const dist = Math.hypot(player.x - item.x, player.y - item.y);
    if (dist <= player.radius + item.radius) {
      score += item.points;
      collectedCount += 1;
      events = pushEvent(
        events,
        elapsedMs,
        'collecte',
        `${spec.collectibles.label} collecté (+${item.points} pts, ${collectedCount}/${state.totalCollectibles}).`
      );
      for (let i = 0; i < 8; i += 1) {
        const ang = (i / 8) * Math.PI * 2;
        particles.push({
          x: item.x,
          y: item.y,
          vx: Math.cos(ang) * 75,
          vy: Math.sin(ang) * 75,
          lifeMs: 260,
          maxLifeMs: 260,
          color: spec.collectibles.color,
          size: 3,
        });
      }
      callbacks?.onCollect?.();
      return { ...item, collected: true };
    }
    return item;
  });

  // Vérification victoire
  const wonByCollect = collectedCount >= state.totalCollectibles;
  const wonByScore =
    spec.rules.winCondition === 'target_score' && score >= spec.rules.targetScore;
  if (wonByCollect || wonByScore) {
    events = pushEvent(events, elapsedMs, 'fin', `Victoire atteinte avec un score de ${score} pts.`);
    callbacks?.onVictory?.();
    return {
      ...state,
      status: 'VICTORY',
      elapsedMs,
      timeRemainingMs,
      score,
      collectedCount,
      player,
      collectibles,
      particles,
      events,
    };
  }

  // Mise à jour des dangers mobiles et test de collision
  let status: GameRuntimeState['status'] = 'PLAYING';
  const hazards = state.hazards.map((h) => {
    const nextH = { ...h };

    if (nextH.behavior === 'chase_slow') {
      const toPlayerX = player.x - nextH.x;
      const toPlayerY = player.y - nextH.y;
      const len = Math.hypot(toPlayerX, toPlayerY) || 1;
      nextH.vx = (toPlayerX / len) * (nextH.speed * 0.72);
      nextH.vy = (toPlayerY / len) * (nextH.speed * 0.72);
    }

    const hx = nextH.x + nextH.vx * dt;
    if (
      hx - nextH.radius < 0 ||
      hx + nextH.radius > spec.arena.width ||
      state.obstacles.some((w) => circleRectCollides(hx, nextH.y, nextH.radius, w))
    ) {
      nextH.vx = -nextH.vx;
    } else {
      nextH.x = hx;
    }

    const hy = nextH.y + nextH.vy * dt;
    if (
      hy - nextH.radius < 0 ||
      hy + nextH.radius > spec.arena.height ||
      state.obstacles.some((w) => circleRectCollides(nextH.x, hy, nextH.radius, w))
    ) {
      nextH.vy = -nextH.vy;
    } else {
      nextH.y = hy;
    }

    if (
      status === 'PLAYING' &&
      player.invulnerableRemainingMs <= 0 &&
      Math.hypot(player.x - nextH.x, player.y - nextH.y) <= player.radius + nextH.radius
    ) {
      player.lives = Math.max(0, player.lives - nextH.damage);
      player.invulnerableRemainingMs = spec.player.invulnerabilityMs;
      events = pushEvent(
        events,
        elapsedMs,
        'degat',
        `Collision avec ${spec.hazards.label} (-${nextH.damage} vie, ${player.lives} restante(s)).`
      );
      for (let i = 0; i < 10; i += 1) {
        const ang = (i / 10) * Math.PI * 2;
        particles.push({
          x: player.x,
          y: player.y,
          vx: Math.cos(ang) * 95,
          vy: Math.sin(ang) * 95,
          lifeMs: 320,
          maxLifeMs: 320,
          color: spec.hazards.color,
          size: 3.5,
        });
      }
      if (player.lives <= 0) {
        status = 'DEFEAT';
        events = pushEvent(events, elapsedMs, 'fin', 'Plus de vies restantes : défaite.');
        callbacks?.onDefeat?.();
      } else {
        callbacks?.onDamage?.();
      }
    }

    return nextH;
  });

  return {
    ...state,
    status,
    elapsedMs,
    timeRemainingMs,
    score,
    collectedCount,
    player,
    collectibles,
    hazards,
    particles,
    events,
  };
}

export function renderRuntimeCanvas(
  ctx: CanvasRenderingContext2D,
  state: GameRuntimeState,
  showDebugVectors = false
): void {
  const { spec } = state;
  const { width, height } = spec.arena;

  // Fond d'arène + grille technique discrète
  ctx.fillStyle = spec.arena.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = spec.arena.gridColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = 40; gx < width; gx += 40) {
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, height);
  }
  for (let gy = 40; gy < height; gy += 40) {
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
  }
  ctx.stroke();

  // Bordure intérieure
  ctx.strokeStyle = spec.arena.wallColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Obstacles rectangulaires
  for (const wall of state.obstacles) {
    ctx.fillStyle = spec.obstacles.color;
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1;
    ctx.strokeRect(wall.x + 0.5, wall.y + 0.5, wall.width - 1, wall.height - 1);
  }

  // Objets à collecter (losanges nets)
  for (const col of state.collectibles) {
    if (col.collected) continue;
    ctx.save();
    ctx.translate(col.x, col.y);
    ctx.rotate(Math.PI / 4);
    const s = col.radius * 1.25;
    ctx.fillStyle = spec.collectibles.color;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = '#FEF3C7';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }

  // Dangers mobiles
  for (const haz of state.hazards) {
    ctx.save();
    ctx.fillStyle = spec.hazards.color;
    ctx.beginPath();
    ctx.arc(haz.x, haz.y, haz.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FECDD3';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (showDebugVectors) {
      ctx.strokeStyle = '#FB7185';
      ctx.beginPath();
      ctx.moveTo(haz.x, haz.y);
      ctx.lineTo(haz.x + haz.vx * 0.25, haz.y + haz.vy * 0.25);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Particules d'impact / collecte
  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.lifeMs / p.maxLifeMs);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.restore();
  }

  // Personnage joueur
  ctx.save();
  const blinking =
    state.player.invulnerableRemainingMs > 0 &&
    Math.floor(state.player.invulnerableRemainingMs / 80) % 2 === 0;
  ctx.globalAlpha = blinking ? 0.45 : 1;
  ctx.fillStyle = spec.player.color;
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#E0F2FE';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Indicateur directionnel du personnage
  const dirX = state.player.x + Math.cos(state.player.facingAngle) * (state.player.radius - 3);
  const dirY = state.player.y + Math.sin(state.player.facingAngle) * (state.player.radius - 3);
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(dirX, dirY, 3, 0, Math.PI * 2);
  ctx.fill();

  if (showDebugVectors) {
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(state.player.x, state.player.y);
    ctx.lineTo(
      state.player.x + state.player.vx * 0.22,
      state.player.y + state.player.vy * 0.22
    );
    ctx.stroke();
  }
  ctx.restore();
}

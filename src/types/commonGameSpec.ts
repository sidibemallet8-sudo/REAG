import { AnalysisReport, ReagGameSpec, SpecValidationResult } from './reag';

export interface CommonSceneSpec {
  id: string;
  name: string;
  dimension: '2d' | '3d';
  bounds: { width: number; height: number; depth: number };
}

export interface CommonEnvironmentSpec {
  backgroundColor: string;
  gridColor: string;
  wallColor: string;
  lightingMode: 'flat_2d' | 'directional_ambient_3d';
}

export interface CommonCharacterSpec {
  id: string;
  role: 'player' | 'hazard';
  label: string;
  position: { x: number; y: number; z: number };
  radius: number;
  speed: number;
  health: number;
  color: string;
  behavior?: string;
}

export interface CommonObjectSpec {
  id: string;
  kind: 'collectible' | 'obstacle';
  label: string;
  count: number;
  points?: number;
  radius?: number;
  minSize?: number;
  maxSize?: number;
  color: string;
}

export interface CommonCameraSpec {
  mode: 'orthographic_topdown' | 'perspective_follow';
  fov: number;
  distance: number;
}

export interface CommonControlSpec {
  keyboardBindings: string[];
  touchEnabled: boolean;
  pauseKeys: string[];
}

export interface CommonMechanicSpec {
  id: string;
  category: string;
  name: string;
  summary: string;
  parameters: Record<string, string | number | boolean>;
}

export interface CommonPhysicsSpec {
  gravity: { x: number; y: number; z: number };
  collisionModel: 'aabb_circle_2d' | 'box_sphere_3d';
  wallSliding: boolean;
}

export interface CommonAnimationSpec {
  id: string;
  target: 'player' | 'collectible' | 'hazard';
  kind: 'blink_invulnerable' | 'particle_burst' | 'pulse';
  durationMs: number;
}

export interface CommonSoundSpec {
  event: 'collect' | 'damage' | 'victory' | 'defeat';
  synthesisMode: 'web_audio_oscillator';
  enabledByDefault: boolean;
}

export interface CommonEvidenceLink {
  mechanicId: string;
  sourceIds: string[];
  observationIds: string[];
  verified: boolean;
}

export interface CommonUncertaintyItem {
  id: string;
  kind: 'gap' | 'contradiction' | 'invalid_source_ref';
  description: string;
}

export interface CommonGameSpecification {
  schemaVersion: 'common-1.0';
  projectId: string;
  title: string;
  dimension: '2d' | '3d';
  scenes: CommonSceneSpec[];
  environments: CommonEnvironmentSpec[];
  characters: CommonCharacterSpec[];
  objects: CommonObjectSpec[];
  cameras: CommonCameraSpec[];
  controls: CommonControlSpec;
  mechanics: CommonMechanicSpec[];
  rules: {
    winCondition: 'collect_all' | 'target_score';
    targetScore: number;
    timeLimitSeconds: number | null;
  };
  physics: CommonPhysicsSpec;
  animations: CommonAnimationSpec[];
  sounds: CommonSoundSpec[];
  victoryConditions: string[];
  defeatConditions: string[];
  evidence: CommonEvidenceLink[];
  uncertainties: CommonUncertaintyItem[];
  validations: SpecValidationResult;
}

export function buildCommonGameSpecification(
  spec2d: ReagGameSpec,
  analysis: AnalysisReport | null,
  validation: SpecValidationResult,
  dimension: '2d' | '3d' = '2d'
): CommonGameSpecification {
  const uncertainties: CommonUncertaintyItem[] = [];
  if (analysis) {
    analysis.gaps.forEach((g, idx) => {
      uncertainties.push({ id: `unc_gap_${idx + 1}`, kind: 'gap', description: g });
    });
    analysis.contradictions.forEach((c) => {
      uncertainties.push({
        id: `unc_${c.id}`,
        kind: 'contradiction',
        description: c.resolutionNote,
      });
    });
    analysis.invalidSourceReferences.forEach((r) => {
      uncertainties.push({
        id: `unc_ref_${r.observationId}`,
        kind: 'invalid_source_ref',
        description: `${r.observationTitle} référence la source absente ${r.invalidSourceId}`,
      });
    });
  }

  return {
    schemaVersion: 'common-1.0',
    projectId: spec2d.projectId,
    title: spec2d.title,
    dimension,
    scenes: [
      {
        id: 'scene_main',
        name: spec2d.title,
        dimension,
        bounds: {
          width: spec2d.arena.width,
          height: spec2d.arena.height,
          depth: dimension === '3d' ? spec2d.arena.height : 0,
        },
      },
    ],
    environments: [
      {
        backgroundColor: spec2d.arena.backgroundColor,
        gridColor: spec2d.arena.gridColor,
        wallColor: spec2d.arena.wallColor,
        lightingMode: dimension === '3d' ? 'directional_ambient_3d' : 'flat_2d',
      },
    ],
    characters: [
      {
        id: 'char_player',
        role: 'player',
        label: 'Avatar Joueur',
        position: { x: Math.round(spec2d.arena.width * 0.14), y: Math.round(spec2d.arena.height * 0.5), z: 0 },
        radius: spec2d.player.radius,
        speed: spec2d.player.speed,
        health: spec2d.player.initialLives,
        color: spec2d.player.color,
      },
      {
        id: 'char_hazards',
        role: 'hazard',
        label: spec2d.hazards.label,
        position: { x: Math.round(spec2d.arena.width * 0.65), y: Math.round(spec2d.arena.height * 0.5), z: 0 },
        radius: spec2d.hazards.radius,
        speed: spec2d.hazards.speed,
        health: spec2d.hazards.count,
        color: spec2d.hazards.color,
        behavior: spec2d.hazards.behavior,
      },
    ],
    objects: [
      {
        id: 'obj_collectibles',
        kind: 'collectible',
        label: spec2d.collectibles.label,
        count: spec2d.collectibles.count,
        points: spec2d.collectibles.pointsPerItem,
        radius: spec2d.collectibles.radius,
        color: spec2d.collectibles.color,
      },
      {
        id: 'obj_obstacles',
        kind: 'obstacle',
        label: 'Murs et cloisons',
        count: spec2d.obstacles.count,
        minSize: spec2d.obstacles.minSize,
        maxSize: spec2d.obstacles.maxSize,
        color: spec2d.obstacles.color,
      },
    ],
    cameras: [
      {
        mode: dimension === '3d' ? 'perspective_follow' : 'orthographic_topdown',
        fov: dimension === '3d' ? 55 : 0,
        distance: dimension === '3d' ? 420 : 1,
      },
    ],
    controls: {
      keyboardBindings: ['ZQSD', 'WASD', 'Flèches directionnelles'],
      touchEnabled: spec2d.rules.allowTouchControls,
      pauseKeys: ['Space'],
    },
    mechanics: (analysis?.extractedMechanics || []).map((m) => ({
      id: m.id,
      category: m.category,
      name: m.name,
      summary: m.ruleSummary,
      parameters: m.parameters,
    })),
    rules: {
      winCondition: spec2d.rules.winCondition,
      targetScore: spec2d.rules.targetScore,
      timeLimitSeconds: spec2d.rules.timeLimitSeconds,
    },
    physics: {
      gravity: { x: 0, y: 0, z: 0 },
      collisionModel: dimension === '3d' ? 'box_sphere_3d' : 'aabb_circle_2d',
      wallSliding: true,
    },
    animations: [
      { id: 'anim_invuln', target: 'player', kind: 'blink_invulnerable', durationMs: spec2d.player.invulnerabilityMs },
      { id: 'anim_collect', target: 'collectible', kind: 'particle_burst', durationMs: 260 },
      { id: 'anim_damage', target: 'hazard', kind: 'particle_burst', durationMs: 320 },
    ],
    sounds: [
      { event: 'collect', synthesisMode: 'web_audio_oscillator', enabledByDefault: true },
      { event: 'damage', synthesisMode: 'web_audio_oscillator', enabledByDefault: true },
      { event: 'victory', synthesisMode: 'web_audio_oscillator', enabledByDefault: true },
      { event: 'defeat', synthesisMode: 'web_audio_oscillator', enabledByDefault: true },
    ],
    victoryConditions:
      spec2d.rules.winCondition === 'target_score'
        ? [`Atteindre un score >= ${spec2d.rules.targetScore}`]
        : [`Collecter les ${spec2d.collectibles.count} ${spec2d.collectibles.label}`],
    defeatConditions: [
      `Perdre toutes les ${spec2d.player.initialLives} vies`,
      ...(spec2d.rules.timeLimitSeconds !== null
        ? [`Expiration du chronomètre (${spec2d.rules.timeLimitSeconds} s)`]
        : []),
    ],
    evidence: (analysis?.extractedMechanics || []).map((m) => ({
      mechanicId: m.id,
      sourceIds: m.evidenceSourceIds,
      observationIds: m.evidenceObservationIds,
      verified: m.sourced,
    })),
    uncertainties,
    validations: validation,
  };
}

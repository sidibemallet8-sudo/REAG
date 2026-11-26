import {
  AnalysisReport,
  ReagGameSpec,
  ReagProject,
  SpecValidationResult,
} from '../types/reag';
import { clamp } from '../utils/deterministic';

function findMechanicParam<T extends string | number | boolean>(
  report: AnalysisReport,
  category: string,
  key: string,
  fallback: T
): T {
  const mech = report.extractedMechanics.find((m) => m.category === category);
  if (!mech) return fallback;
  const val = mech.parameters[key];
  if (typeof val === typeof fallback) {
    return val as T;
  }
  return fallback;
}

export const SpecificationEngine = {
  buildSpecification(
    project: ReagProject,
    report: AnalysisReport,
    existingSpec?: ReagGameSpec | null
  ): ReagGameSpec {
    if (!report.canReconstruct) {
      throw new Error(
        report.refusalReason ||
          'Impossible de générer une spécification : analyse insuffisante.'
      );
    }

    const speed = clamp(
      findMechanicParam<number>(report, 'deplacement', 'speed', existingSpec?.player.speed ?? 215),
      90,
      460
    );
    const playerRadius = clamp(
      findMechanicParam<number>(report, 'deplacement', 'radius', existingSpec?.player.radius ?? 14),
      10,
      24
    );
    const collectibleCount = clamp(
      findMechanicParam<number>(report, 'collecte', 'count', existingSpec?.collectibles.count ?? 10),
      1,
      40
    );
    const pointsPerItem = clamp(
      findMechanicParam<number>(
        report,
        'collecte',
        'pointsPerItem',
        findMechanicParam<number>(report, 'score', 'pointsPerItem', existingSpec?.collectibles.pointsPerItem ?? 100)
      ),
      10,
      1000
    );
    const collectibleLabel = findMechanicParam<string>(
      report,
      'collecte',
      'label',
      existingSpec?.collectibles.label ?? 'Éclats'
    );

    const obstacleCount = clamp(
      findMechanicParam<number>(report, 'obstacle', 'obstacleCount', existingSpec?.obstacles.count ?? 8),
      0,
      20
    );
    const minSize = clamp(
      findMechanicParam<number>(report, 'obstacle', 'minSize', existingSpec?.obstacles.minSize ?? 48),
      28,
      90
    );
    const maxSize = clamp(
      findMechanicParam<number>(report, 'obstacle', 'maxSize', existingSpec?.obstacles.maxSize ?? 108),
      minSize + 8,
      150
    );

    const hazardCount = clamp(
      findMechanicParam<number>(report, 'danger', 'hazardCount', existingSpec?.hazards.count ?? 4),
      0,
      14
    );
    const hazardSpeed = clamp(
      findMechanicParam<number>(report, 'danger', 'hazardSpeed', existingSpec?.hazards.speed ?? 125),
      40,
      320
    );
    const invulnMs = clamp(
      findMechanicParam<number>(
        report,
        'danger',
        'invulnerabilityMs',
        existingSpec?.player.invulnerabilityMs ?? 1200
      ),
      300,
      3000
    );
    const hazardBehaviorRaw = findMechanicParam<string>(
      report,
      'danger',
      'behavior',
      existingSpec?.hazards.behavior ?? 'patrol_bounce'
    );
    const hazardBehavior: 'patrol_bounce' | 'chase_slow' =
      hazardBehaviorRaw === 'chase_slow' ? 'chase_slow' : 'patrol_bounce';
    const hazardLabel = findMechanicParam<string>(
      report,
      'danger',
      'label',
      existingSpec?.hazards.label ?? 'Sentinelles'
    );

    const initialLives = clamp(
      findMechanicParam<number>(report, 'defaite', 'initialLives', existingSpec?.player.initialLives ?? 3),
      1,
      9
    );

    const timeLimitRaw = findMechanicParam<number>(
      report,
      'victoire',
      'timeLimitSeconds',
      findMechanicParam<number>(
        report,
        'defaite',
        'timeLimitSeconds',
        existingSpec?.rules.timeLimitSeconds ?? 90
      )
    );
    const timeLimitSeconds = timeLimitRaw > 0 ? clamp(timeLimitRaw, 15, 600) : null;

    const winConditionRaw = findMechanicParam<string>(
      report,
      'victoire',
      'winCondition',
      existingSpec?.rules.winCondition ?? 'collect_all'
    );
    const winCondition: 'collect_all' | 'target_score' =
      winConditionRaw === 'target_score' ? 'target_score' : 'collect_all';

    const allowTouchControls = findMechanicParam<boolean>(
      report,
      'controle',
      'allowTouchControls',
      existingSpec?.rules.allowTouchControls ?? true
    );

    return {
      specVersion: '1.0',
      projectId: project.id,
      title: project.name,
      subtitle: project.referenceSubject || 'Jeu 2D original reconstruit par REAG',
      genre: 'arcade_2d_topdown',
      arena: existingSpec?.arena ?? {
        width: 720,
        height: 460,
        backgroundColor: '#0B1120',
        gridColor: '#172033',
        wallColor: '#334155',
      },
      player: {
        radius: playerRadius,
        speed,
        initialLives,
        invulnerabilityMs: invulnMs,
        color: existingSpec?.player.color ?? '#38BDF8',
      },
      collectibles: {
        label: collectibleLabel,
        count: collectibleCount,
        pointsPerItem,
        radius: 10,
        color: existingSpec?.collectibles.color ?? '#FBBF24',
      },
      obstacles: {
        count: obstacleCount,
        minSize,
        maxSize,
        layoutSeed: existingSpec?.obstacles.layoutSeed ?? 4201,
        color: existingSpec?.obstacles.color ?? '#475569',
      },
      hazards: {
        label: hazardLabel,
        count: hazardCount,
        speed: hazardSpeed,
        radius: 13,
        damage: 1,
        behavior: hazardBehavior,
        color: existingSpec?.hazards.color ?? '#F43F5E',
      },
      rules: {
        winCondition,
        targetScore: collectibleCount * pointsPerItem,
        timeLimitSeconds,
        allowTouchControls,
      },
      traceabilitySummary: {
        sourceCount: report.metrics.sourceCount,
        observationCount: report.metrics.observationCount,
        sourceTraceabilityRatio: report.metrics.sourceTraceabilityRatio,
      },
    };
  },

  validateSpecification(spec: ReagGameSpec): SpecValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (spec.specVersion !== '1.0') {
      errors.push('Version de spécification non supportée (attendue : 1.0).');
    }
    if (!spec.title || !spec.title.trim()) {
      errors.push('Le titre du jeu dans la spécification est vide.');
    }
    if (spec.arena.width < 360 || spec.arena.height < 280) {
      errors.push("Les dimensions minimales de l'arène sont 360×280 px.");
    }
    if (spec.player.speed < 40 || spec.player.speed > 700) {
      errors.push('La vitesse du joueur doit être comprise entre 40 et 700 px/s.');
    }
    if (spec.player.initialLives < 1 || spec.player.initialLives > 20) {
      errors.push('Le nombre de vies initiales doit être entre 1 et 20.');
    }
    if (spec.collectibles.count < 1) {
      errors.push('Au moins 1 objet à collecter est requis pour garantir un objectif.');
    }
    if (spec.rules.winCondition === 'target_score') {
      const maxPossible = spec.collectibles.count * spec.collectibles.pointsPerItem;
      if (spec.rules.targetScore > maxPossible) {
        errors.push(
          `Score cible (${spec.rules.targetScore}) impossible à atteindre : maximum disponible = ${maxPossible}.`
        );
      }
    }
    if (spec.hazards.count === 0 && spec.rules.timeLimitSeconds === null) {
      warnings.push(
        'Aucun danger mobile et aucun chronomètre configurés : aucune condition de défaite ne peut se déclencher.'
      );
    }
    if (spec.traceabilitySummary.sourceCount === 0) {
      warnings.push('Spécification générée sans aucune source documentaire attachée.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },
};

import {
  AnalysisReport,
  ReagGameSpec,
  ReagProject,
  SpecValidationResult,
} from '../types/reag';
import { clamp } from '../utils/deterministic';

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value.trim());
}

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
    if (typeof val === 'number' && !Number.isFinite(val)) return fallback;
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
    const collectibleCount = Math.round(
      clamp(
        findMechanicParam<number>(report, 'collecte', 'count', existingSpec?.collectibles.count ?? 10),
        1,
        40
      )
    );
    const pointsPerItem = Math.round(
      clamp(
        findMechanicParam<number>(
          report,
          'collecte',
          'pointsPerItem',
          findMechanicParam<number>(
            report,
            'score',
            'pointsPerItem',
            existingSpec?.collectibles.pointsPerItem ?? 100
          )
        ),
        10,
        1000
      )
    );
    const collectibleLabel = findMechanicParam<string>(
      report,
      'collecte',
      'label',
      existingSpec?.collectibles.label ?? 'Éclats'
    );

    const obstacleCount = Math.round(
      clamp(
        findMechanicParam<number>(report, 'obstacle', 'obstacleCount', existingSpec?.obstacles.count ?? 8),
        0,
        20
      )
    );
    const minSize = Math.round(
      clamp(
        findMechanicParam<number>(report, 'obstacle', 'minSize', existingSpec?.obstacles.minSize ?? 48),
        28,
        90
      )
    );
    const maxSize = Math.round(
      clamp(
        findMechanicParam<number>(report, 'obstacle', 'maxSize', existingSpec?.obstacles.maxSize ?? 108),
        minSize + 8,
        150
      )
    );

    const hazardCount = Math.round(
      clamp(
        findMechanicParam<number>(report, 'danger', 'hazardCount', existingSpec?.hazards.count ?? 4),
        0,
        14
      )
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

    const initialLives = Math.round(
      clamp(
        findMechanicParam<number>(report, 'defaite', 'initialLives', existingSpec?.player.initialLives ?? 3),
        1,
        9
      )
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
    const timeLimitSeconds = timeLimitRaw > 0 ? Math.round(clamp(timeLimitRaw, 15, 600)) : null;

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
        targetScore: existingSpec?.rules.targetScore ?? collectibleCount * pointsPerItem,
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

    if (!spec || typeof spec !== 'object') {
      return {
        valid: false,
        errors: ['La spécification fournie est absente ou invalide.'],
        warnings: [],
      };
    }

    if (spec.specVersion !== '1.0') {
      errors.push('Version de spécification non supportée (attendue : 1.0).');
    }
    if (typeof spec.title !== 'string' || !spec.title.trim()) {
      errors.push('Le titre du jeu dans la spécification est vide.');
    }
    if (spec.genre !== 'arcade_2d_topdown') {
      errors.push('Genre non supporté en V2 (seul "arcade_2d_topdown" est accepté).');
    }

    // Validation Arène
    if (!spec.arena || typeof spec.arena !== 'object') {
      errors.push("Bloc 'arena' manquant.");
    } else {
      if (!isFiniteNumber(spec.arena.width) || spec.arena.width < 360 || spec.arena.width > 1920) {
        errors.push("La largeur de l'arène doit être un nombre fini entre 360 et 1920 px.");
      }
      if (!isFiniteNumber(spec.arena.height) || spec.arena.height < 280 || spec.arena.height > 1200) {
        errors.push("La hauteur de l'arène doit être un nombre fini entre 280 et 1200 px.");
      }
      if (!isValidHexColor(spec.arena.backgroundColor)) {
        errors.push("La couleur d'arrière-plan de l'arène doit être un code hexadécimal valide (#RRGGBB).");
      }
      if (!isValidHexColor(spec.arena.gridColor)) {
        errors.push('La couleur de grille doit être un code hexadécimal valide (#RRGGBB).');
      }
      if (!isValidHexColor(spec.arena.wallColor)) {
        errors.push('La couleur de bordure doit être un code hexadécimal valide (#RRGGBB).');
      }
    }

    // Validation Joueur
    if (!spec.player || typeof spec.player !== 'object') {
      errors.push("Bloc 'player' manquant.");
    } else {
      if (!isFiniteNumber(spec.player.radius) || spec.player.radius < 6 || spec.player.radius > 40) {
        errors.push('Le rayon du joueur doit être un nombre fini entre 6 et 40 px.');
      }
      if (!isFiniteNumber(spec.player.speed) || spec.player.speed < 40 || spec.player.speed > 700) {
        errors.push('La vitesse du joueur doit être un nombre fini entre 40 et 700 px/s.');
      }
      if (
        !isFiniteNumber(spec.player.initialLives) ||
        !Number.isInteger(spec.player.initialLives) ||
        spec.player.initialLives < 1 ||
        spec.player.initialLives > 20
      ) {
        errors.push('Le nombre de vies initiales doit être un entier entre 1 et 20.');
      }
      if (
        !isFiniteNumber(spec.player.invulnerabilityMs) ||
        spec.player.invulnerabilityMs < 0 ||
        spec.player.invulnerabilityMs > 10000
      ) {
        errors.push("La durée d'invulnérabilité doit être un nombre fini entre 0 et 10000 ms.");
      }
      if (!isValidHexColor(spec.player.color)) {
        errors.push('La couleur du joueur doit être un code hexadécimal valide.');
      }
    }

    // Validation Collectibles
    if (!spec.collectibles || typeof spec.collectibles !== 'object') {
      errors.push("Bloc 'collectibles' manquant.");
    } else {
      if (typeof spec.collectibles.label !== 'string' || !spec.collectibles.label.trim()) {
        errors.push('Le libellé des objets à collecter est requis.');
      }
      if (
        !isFiniteNumber(spec.collectibles.count) ||
        !Number.isInteger(spec.collectibles.count) ||
        spec.collectibles.count < 1 ||
        spec.collectibles.count > 100
      ) {
        errors.push('Le nombre d’objets à collecter doit être un entier entre 1 et 100.');
      }
      if (
        !isFiniteNumber(spec.collectibles.pointsPerItem) ||
        spec.collectibles.pointsPerItem < 1 ||
        spec.collectibles.pointsPerItem > 10000
      ) {
        errors.push('Les points par objet doivent être un nombre fini entre 1 et 10000.');
      }
      if (
        !isFiniteNumber(spec.collectibles.radius) ||
        spec.collectibles.radius < 4 ||
        spec.collectibles.radius > 30
      ) {
        errors.push('Le rayon des objets à collecter doit être un nombre fini entre 4 et 30 px.');
      }
      if (!isValidHexColor(spec.collectibles.color)) {
        errors.push('La couleur des objets à collecter doit être un code hexadécimal valide.');
      }
    }

    // Validation Obstacles
    if (!spec.obstacles || typeof spec.obstacles !== 'object') {
      errors.push("Bloc 'obstacles' manquant.");
    } else {
      if (
        !isFiniteNumber(spec.obstacles.count) ||
        !Number.isInteger(spec.obstacles.count) ||
        spec.obstacles.count < 0 ||
        spec.obstacles.count > 40
      ) {
        errors.push("Le nombre d'obstacles doit être un entier entre 0 et 40.");
      }
      if (
        !isFiniteNumber(spec.obstacles.minSize) ||
        spec.obstacles.minSize < 16 ||
        spec.obstacles.minSize > 200
      ) {
        errors.push('La taille minimale des obstacles doit être un nombre fini entre 16 et 200 px.');
      }
      if (
        !isFiniteNumber(spec.obstacles.maxSize) ||
        spec.obstacles.maxSize < 16 ||
        spec.obstacles.maxSize > 260
      ) {
        errors.push('La taille maximale des obstacles doit être un nombre fini entre 16 et 260 px.');
      }
      if (
        isFiniteNumber(spec.obstacles.minSize) &&
        isFiniteNumber(spec.obstacles.maxSize) &&
        spec.obstacles.minSize > spec.obstacles.maxSize
      ) {
        errors.push('La taille minimale des obstacles ne peut pas dépasser la taille maximale.');
      }
      if (!isFiniteNumber(spec.obstacles.layoutSeed)) {
        errors.push('La graine de placement (layoutSeed) doit être un nombre fini.');
      }
      if (!isValidHexColor(spec.obstacles.color)) {
        errors.push('La couleur des obstacles doit être un code hexadécimal valide.');
      }
      if (
        spec.arena &&
        isFiniteNumber(spec.arena.width) &&
        isFiniteNumber(spec.arena.height) &&
        isFiniteNumber(spec.obstacles.maxSize) &&
        spec.obstacles.count > 0 &&
        (spec.obstacles.maxSize >= spec.arena.width * 0.45 ||
          spec.obstacles.maxSize >= spec.arena.height * 0.45)
      ) {
        errors.push(
          "La taille maximale des obstacles est incompatible avec les dimensions de l'arène."
        );
      }
    }

    // Validation Dangers
    if (!spec.hazards || typeof spec.hazards !== 'object') {
      errors.push("Bloc 'hazards' manquant.");
    } else {
      if (typeof spec.hazards.label !== 'string' || !spec.hazards.label.trim()) {
        errors.push('Le libellé des dangers mobiles est requis.');
      }
      if (
        !isFiniteNumber(spec.hazards.count) ||
        !Number.isInteger(spec.hazards.count) ||
        spec.hazards.count < 0 ||
        spec.hazards.count > 30
      ) {
        errors.push('Le nombre de dangers doit être un entier entre 0 et 30.');
      }
      if (!isFiniteNumber(spec.hazards.speed) || spec.hazards.speed < 0 || spec.hazards.speed > 600) {
        errors.push('La vitesse des dangers doit être un nombre fini entre 0 et 600 px/s.');
      }
      if (
        !isFiniteNumber(spec.hazards.radius) ||
        spec.hazards.radius < 4 ||
        spec.hazards.radius > 40
      ) {
        errors.push('Le rayon des dangers doit être un nombre fini entre 4 et 40 px.');
      }
      if (
        !isFiniteNumber(spec.hazards.damage) ||
        !Number.isInteger(spec.hazards.damage) ||
        spec.hazards.damage < 1 ||
        spec.hazards.damage > 10
      ) {
        errors.push('Les dégâts des dangers doivent être un entier entre 1 et 10.');
      }
      if (spec.hazards.behavior !== 'patrol_bounce' && spec.hazards.behavior !== 'chase_slow') {
        errors.push('Comportement de danger invalide (patrol_bounce ou chase_slow attendu).');
      }
      if (!isValidHexColor(spec.hazards.color)) {
        errors.push('La couleur des dangers doit être un code hexadécimal valide.');
      }
    }

    // Validation Règles
    if (!spec.rules || typeof spec.rules !== 'object') {
      errors.push("Bloc 'rules' manquant.");
    } else {
      if (spec.rules.winCondition !== 'collect_all' && spec.rules.winCondition !== 'target_score') {
        errors.push('Condition de victoire invalide (collect_all ou target_score attendu).');
      }
      if (!isFiniteNumber(spec.rules.targetScore) || spec.rules.targetScore <= 0) {
        errors.push('Le score cible doit être un nombre fini strictement positif.');
      } else if (
        spec.rules.winCondition === 'target_score' &&
        spec.collectibles &&
        isFiniteNumber(spec.collectibles.count) &&
        isFiniteNumber(spec.collectibles.pointsPerItem)
      ) {
        const maxPossible = spec.collectibles.count * spec.collectibles.pointsPerItem;
        if (spec.rules.targetScore > maxPossible) {
          errors.push(
            `Score cible (${spec.rules.targetScore}) impossible à atteindre : maximum disponible = ${maxPossible}.`
          );
        }
      }

      if (spec.rules.timeLimitSeconds !== null) {
        if (
          !isFiniteNumber(spec.rules.timeLimitSeconds) ||
          spec.rules.timeLimitSeconds <= 0 ||
          spec.rules.timeLimitSeconds > 3600
        ) {
          errors.push(
            'Le chronomètre limite doit être null ou un nombre fini compris entre 1 et 3600 secondes.'
          );
        }
      }
      if (typeof spec.rules.allowTouchControls !== 'boolean') {
        errors.push('Le paramètre allowTouchControls doit être un booléen.');
      }
    }

    if (
      spec.hazards &&
      spec.rules &&
      spec.hazards.count === 0 &&
      spec.rules.timeLimitSeconds === null
    ) {
      warnings.push(
        'Aucun danger mobile et aucun chronomètre configurés : aucune condition de défaite ne peut se déclencher.'
      );
    }
    if (spec.traceabilitySummary && spec.traceabilitySummary.sourceCount === 0) {
      warnings.push('Spécification générée sans aucune source documentaire attachée.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },
};

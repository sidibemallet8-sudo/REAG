import {
  AnalysisReport,
  ExtractedMechanic,
  GameObservation,
  ObservationCategory,
  ReagProject,
} from '../types/reag';

const CATEGORY_LABELS: Record<ObservationCategory, string> = {
  deplacement: 'Système de déplacement',
  collecte: 'Boucle de collecte',
  obstacle: 'Collisions et obstacles',
  danger: 'Dangers et entités hostiles',
  score: 'Comptabilisation du score',
  victoire: 'Condition de victoire',
  defaite: 'Condition de défaite',
  controle: 'Schéma de contrôles',
  physique: 'Paramètres physiques',
};

export const V1_KNOWN_LIMITATIONS: string[] = [
  "REAG V1 ne convertit jamais un jeu commercial à partir de son seul nom ; toute génération exige des observations explicites.",
  "Le moteur de rendu V1 cible exclusivement l'arène 2D vue de dessus (HTML5 Canvas) avec collisions AABB/cercle.",
  'Les graphismes générés sont géométriques et vectoriels ; aucun rip ou extraction de sprites commerciaux n’est effectué.',
  'Les mécaniques complexes non supportées en V1 (3D, réseau multijoueur, arbre de dialogues, inventaire RPG) ne sont pas générées automatiquement.',
];

function extractNumericParam(
  observations: GameObservation[],
  key: string,
  regex: RegExp
): number | undefined {
  for (const obs of observations) {
    const raw = obs.parameters[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    const match = obs.description.match(regex);
    if (match && match[1]) {
      const val = Number(match[1]);
      if (Number.isFinite(val)) return val;
    }
  }
  return undefined;
}

function extractStringParam(observations: GameObservation[], key: string): string | undefined {
  for (const obs of observations) {
    const raw = obs.parameters[key];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  return undefined;
}

export const GameAnalysisEngine = {
  analyzeProject(project: ReagProject): AnalysisReport {
    const validSourceIds = new Set(project.sources.map((s) => s.id));
    const observations = project.observations;
    const sources = project.sources;

    // Garde-fou méthodologique fondamental : refus honnête sans matière observable suffisante
    if (observations.length < 2) {
      return {
        projectId: project.id,
        analyzedAt: new Date().toISOString(),
        canReconstruct: false,
        refusalReason:
          observations.length === 0
            ? 'Reconstruction refusée : aucune observation n’a été enregistrée. REAG ne peut pas déduire un jeu complet à partir du seul nom du projet.'
            : 'Reconstruction refusée : au moins 2 observations distinctes (ex. déplacement et objectif) sont requises pour formaliser un système jouable.',
        detectedArchetype: 'indetermine',
        extractedMechanics: [],
        controlBindings: [],
        gaps: [
          'Minimum de 2 observations requis pour démarrer l’extraction.',
          sources.length === 0
            ? 'Aucune source documentaire enregistrée pour justifier les mécaniques.'
            : '',
        ].filter(Boolean),
        v1Limitations: [...V1_KNOWN_LIMITATIONS],
        metrics: {
          sourceCount: sources.length,
          observationCount: observations.length,
          sourcedMechanicCount: 0,
          totalMechanicCount: 0,
          sourceTraceabilityRatio: 0,
        },
      };
    }

    const byCategory = new Map<ObservationCategory, GameObservation[]>();
    for (const obs of observations) {
      const list = byCategory.get(obs.category) || [];
      list.push(obs);
      byCategory.set(obs.category, list);
    }

    const extractedMechanics: ExtractedMechanic[] = [];

    for (const [category, catObs] of byCategory.entries()) {
      const evidenceSourceIds = Array.from(
        new Set(
          catObs
            .map((o) => o.sourceId)
            .filter((id): id is string => Boolean(id && validSourceIds.has(id)))
        )
      );

      const mergedParams: Record<string, string | number | boolean> = {};
      for (const obs of catObs) {
        Object.assign(mergedParams, obs.parameters);
      }

      if (category === 'deplacement') {
        const speed = extractNumericParam(catObs, 'speed', /(\d+)\s*(?:px\/s|px)/i);
        if (speed) mergedParams.speed = speed;
      }
      if (category === 'collecte') {
        const count = extractNumericParam(catObs, 'count', /(\d+)\s*(?:éclats?|eclats?|objets?|pièces?|items?)/i);
        const pts = extractNumericParam(catObs, 'pointsPerItem', /(\d+)\s*(?:points?|pts)/i);
        if (count) mergedParams.count = count;
        if (pts) mergedParams.pointsPerItem = pts;
      }
      if (category === 'danger') {
        const hazardCount = extractNumericParam(catObs, 'hazardCount', /(\d+)\s*(?:sentinelles?|ennemis?|dangers?)/i);
        const hazardSpeed = extractNumericParam(catObs, 'hazardSpeed', /(\d+)\s*(?:px\/s)/i);
        if (hazardCount) mergedParams.hazardCount = hazardCount;
        if (hazardSpeed) mergedParams.hazardSpeed = hazardSpeed;
      }
      if (category === 'defaite') {
        const lives = extractNumericParam(catObs, 'initialLives', /(\d+)\s*(?:vies?|pv)/i);
        if (lives) mergedParams.initialLives = lives;
      }

      extractedMechanics.push({
        id: `mech_${category}`,
        category,
        name: CATEGORY_LABELS[category],
        ruleSummary: catObs.map((o) => o.description).join(' '),
        evidenceSourceIds,
        evidenceObservationIds: catObs.map((o) => o.id),
        sourced: evidenceSourceIds.length > 0,
        parameters: mergedParams,
      });
    }

    const gaps: string[] = [];
    if (sources.length === 0) {
      gaps.push('Aucune source documentaire enregistrée : toutes les mécaniques reposent uniquement sur des observations non sourcées.');
    }
    if (!byCategory.has('deplacement')) {
      gaps.push('Aucun comportement de déplacement observé (une vitesse standard de repli sera utilisée si généré).');
    }
    if (!byCategory.has('collecte') && !byCategory.has('victoire')) {
      gaps.push('Aucune mécanique de collecte ou condition de victoire explicite n’a été observée.');
    }
    if (!byCategory.has('obstacle')) {
      gaps.push('Aucun obstacle statique documenté : l’arène risque d’être trop ouverte sans paramétrage manuel.');
    }
    if (!byCategory.has('defaite')) {
      gaps.push('Aucune condition de défaite explicite observée (vies / limite de temps non documentées).');
    }

    const unsourcedCount = extractedMechanics.filter((m) => !m.sourced).length;
    if (unsourcedCount > 0 && sources.length > 0) {
      gaps.push(
        `${unsourcedCount} mécanique(s) extraite(s) ne sont reliées à aucune source documentaire dans le Gestionnaire de sources.`
      );
    }

    const controlObs = byCategory.get('controle') || [];
    const controlBindings: string[] = ['Clavier : Flèches directionnelles / ZQSD / WASD'];
    const touchExplicit = controlObs.some(
      (o) =>
        o.parameters.allowTouchControls === true ||
        /tactile|touch|mobile/i.test(o.description)
    );
    if (touchExplicit || controlObs.length === 0) {
      controlBindings.push('Tactile : Pavé directionnel virtuel à l’écran');
    }
    controlBindings.push('Action système : Espace / Bouton pour Pause et Redémarrage');

    const sourcedMechanicCount = extractedMechanics.filter((m) => m.sourced).length;
    const totalMechanicCount = extractedMechanics.length;
    const sourceTraceabilityRatio =
      totalMechanicCount > 0 ? Math.round((sourcedMechanicCount / totalMechanicCount) * 100) : 0;

    // Si aucune mécanique de déplacement ET aucune collecte/victoire n'est présente,
    // vérifier qu'il reste au moins des observations exploitables
    const hasCoreLoop =
      byCategory.has('deplacement') || byCategory.has('collecte') || byCategory.has('victoire');

    const collectibleLabel = extractStringParam(observations, 'label');
    if (collectibleLabel) {
      // Conservation informative dans les paramètres déjà fusionnés
    }

    return {
      projectId: project.id,
      analyzedAt: new Date().toISOString(),
      canReconstruct: hasCoreLoop,
      refusalReason: hasCoreLoop
        ? undefined
        : 'Reconstruction bloquée : les observations fournies ne décrivent ni déplacement ni objectif de jeu exploitable.',
      detectedArchetype: hasCoreLoop ? 'arcade_arene_2d' : 'indetermine',
      extractedMechanics,
      controlBindings,
      gaps,
      v1Limitations: [...V1_KNOWN_LIMITATIONS],
      metrics: {
        sourceCount: sources.length,
        observationCount: observations.length,
        sourcedMechanicCount,
        totalMechanicCount,
        sourceTraceabilityRatio,
      },
    };
  },
};

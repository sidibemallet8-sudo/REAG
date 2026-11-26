import {
  AnalysisReport,
  ContradictoryValueEntry,
  ExtractedMechanic,
  GameObservation,
  InvalidSourceReference,
  MechanicContradiction,
  ObservationCategory,
  ObservationConfidence,
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

const CONFIDENCE_WEIGHT: Record<ObservationConfidence, number> = {
  confirmee: 3,
  deduite: 2,
  incertaine: 1,
};

export const V1_KNOWN_LIMITATIONS: string[] = [
  "REAG ne convertit jamais un jeu commercial à partir de son seul nom ; toute génération exige des observations explicites.",
  "Le moteur de rendu cible exclusivement l'arène 2D vue de dessus (HTML5 Canvas) avec collisions AABB/cercle.",
  'Les graphismes générés sont géométriques et vectoriels ; aucun rip ou extraction de sprites commerciaux n’est effectué.',
  'Les mécaniques complexes non supportées (3D, réseau multijoueur, arbre de dialogues, inventaire RPG) ne sont pas générées automatiquement.',
];

function extractInlineParamsForCategory(
  category: ObservationCategory,
  obs: GameObservation
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = { ...obs.parameters };
  const desc = obs.description;

  if (category === 'deplacement' && params.speed === undefined) {
    const m = desc.match(/(\d+(?:[.,]\d+)?)\s*(?:px\/s|px\/sec|px)/i);
    if (m) params.speed = Number(m[1].replace(',', '.'));
  }
  if (category === 'collecte') {
    if (params.count === undefined) {
      const m = desc.match(/(\d+)\s*(?:éclats?|eclats?|objets?|pièces?|pieces?|items?)/i);
      if (m) params.count = Number(m[1]);
    }
    if (params.pointsPerItem === undefined) {
      const m = desc.match(/(\d+)\s*(?:points?|pts)/i);
      if (m) params.pointsPerItem = Number(m[1]);
    }
  }
  if (category === 'danger') {
    if (params.hazardCount === undefined) {
      const m = desc.match(/(\d+)\s*(?:sentinelles?|ennemis?|dangers?)/i);
      if (m) params.hazardCount = Number(m[1]);
    }
    if (params.hazardSpeed === undefined) {
      const m = desc.match(/(\d+(?:[.,]\d+)?)\s*(?:px\/s|px\/sec)/i);
      if (m) params.hazardSpeed = Number(m[1].replace(',', '.'));
    }
  }
  if (category === 'defaite' && params.initialLives === undefined) {
    const m = desc.match(/(\d+)\s*(?:vies?|pv)/i);
    if (m) params.initialLives = Number(m[1]);
  }
  if ((category === 'victoire' || category === 'defaite') && params.timeLimitSeconds === undefined) {
    const m = desc.match(/(\d+)\s*(?:s|sec|secondes?)/i);
    if (m && /(chrono|temps|limite|minuteur|durée)/i.test(desc)) {
      params.timeLimitSeconds = Number(m[1]);
    }
  }
  return params;
}

export const GameAnalysisEngine = {
  analyzeProject(project: ReagProject): AnalysisReport {
    const validSourceIds = new Set(project.sources.map((s) => s.id));
    const observations = project.observations;
    const sources = project.sources;

    // Vérification stricte de la traçabilité de chaque observation vers une source existante
    const invalidSourceReferences: InvalidSourceReference[] = [];
    const unsourcedObservationIds: string[] = [];
    let sourcedObservationCount = 0;

    for (const obs of observations) {
      if (obs.sourceId && obs.sourceId.trim().length > 0) {
        if (validSourceIds.has(obs.sourceId)) {
          sourcedObservationCount += 1;
        } else {
          invalidSourceReferences.push({
            observationId: obs.id,
            observationTitle: obs.title,
            invalidSourceId: obs.sourceId,
          });
        }
      } else {
        unsourcedObservationIds.push(obs.id);
      }
    }

    const observationTraceabilityRatio =
      observations.length > 0
        ? Math.round((sourcedObservationCount / observations.length) * 100)
        : 0;

    // Garde-fou méthodologique : refus honnête sans matière observable suffisante
    if (observations.length < 2) {
      const refusalGaps: string[] = [
        'Minimum de 2 observations requis pour démarrer l’extraction.',
      ];
      if (sources.length === 0) {
        refusalGaps.push('Aucune source documentaire enregistrée pour justifier les mécaniques.');
      }
      if (invalidSourceReferences.length > 0) {
        refusalGaps.push(
          `${invalidSourceReferences.length} observation(s) référencent une source inexistante.`
        );
      }

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
        contradictions: [],
        invalidSourceReferences,
        unsourcedObservationIds,
        controlBindings: [],
        gaps: refusalGaps,
        v1Limitations: [...V1_KNOWN_LIMITATIONS],
        metrics: {
          sourceCount: sources.length,
          observationCount: observations.length,
          sourcedObservationCount,
          invalidSourceRefCount: invalidSourceReferences.length,
          observationTraceabilityRatio,
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
    const contradictions: MechanicContradiction[] = [];

    for (const [category, catObs] of byCategory.entries()) {
      const evidenceSourceIds = Array.from(
        new Set(
          catObs
            .map((o) => o.sourceId)
            .filter((id): id is string => Boolean(id && validSourceIds.has(id)))
        )
      );

      // Recensement de toutes les valeurs par paramètre sans écrasement silencieux
      const paramCandidates = new Map<string, ContradictoryValueEntry[]>();
      for (const obs of catObs) {
        const extracted = extractInlineParamsForCategory(category, obs);
        for (const [key, val] of Object.entries(extracted)) {
          if (val === undefined) continue;
          const entries = paramCandidates.get(key) || [];
          entries.push({
            observationId: obs.id,
            observationTitle: obs.title,
            value: val,
            confidence: obs.confidence,
            sourceId: obs.sourceId,
          });
          paramCandidates.set(key, entries);
        }
      }

      const mergedParams: Record<string, string | number | boolean> = {};
      for (const [key, entries] of paramCandidates.entries()) {
        // Classement par niveau de confiance (confirmee > deduite > incertaine), puis source valide
        const ranked = [...entries].sort((a, b) => {
          const confDiff = CONFIDENCE_WEIGHT[b.confidence] - CONFIDENCE_WEIGHT[a.confidence];
          if (confDiff !== 0) return confDiff;
          const aValidSrc = a.sourceId && validSourceIds.has(a.sourceId) ? 1 : 0;
          const bValidSrc = b.sourceId && validSourceIds.has(b.sourceId) ? 1 : 0;
          return bValidSrc - aValidSrc;
        });

        mergedParams[key] = ranked[0].value;

        const distinctValues = new Set(entries.map((e) => String(e.value)));
        if (distinctValues.size > 1) {
          contradictions.push({
            id: `contra_${category}_${key}`,
            category,
            parameterKey: key,
            values: entries,
            selectedValue: ranked[0].value,
            resolutionNote: `Désaccord conservé sur "${key}" (${Array.from(distinctValues).join(
              ' vs '
            )}). Valeur retenue par priorité de confiance (${ranked[0].confidence}) : ${String(
              ranked[0].value
            )}.`,
          });
        }
      }

      // Une mécanique n'est considérée totalement sourcée que si toutes ses observations
      // possèdent une source existante valide
      const allCategoryObsSourced = catObs.every(
        (o) => Boolean(o.sourceId && validSourceIds.has(o.sourceId))
      );

      extractedMechanics.push({
        id: `mech_${category}`,
        category,
        name: CATEGORY_LABELS[category],
        ruleSummary: catObs.map((o) => o.description).join(' '),
        evidenceSourceIds,
        evidenceObservationIds: catObs.map((o) => o.id),
        sourced: allCategoryObsSourced && evidenceSourceIds.length > 0,
        parameters: mergedParams,
      });
    }

    const gaps: string[] = [];
    if (sources.length === 0) {
      gaps.push(
        'Aucune source documentaire enregistrée : toutes les mécaniques reposent uniquement sur des observations non sourcées.'
      );
    }
    if (invalidSourceReferences.length > 0) {
      gaps.push(
        `${invalidSourceReferences.length} observation(s) référencent un identifiant de source inexistant (${invalidSourceReferences
          .map((r) => `${r.observationTitle} -> ${r.invalidSourceId}`)
          .join(', ')}).`
      );
    }
    if (unsourcedObservationIds.length > 0 && sources.length > 0) {
      gaps.push(
        `${unsourcedObservationIds.length} observation(s) ne sont reliées à aucune source documentaire.`
      );
    }
    if (contradictions.length > 0) {
      gaps.push(
        `${contradictions.length} contradiction(s) détectée(s) entre observations ; les désaccords et niveaux de confiance sont préservés dans le rapport.`
      );
    }
    if (!byCategory.has('deplacement')) {
      gaps.push(
        'Aucun comportement de déplacement observé (une vitesse standard de repli sera utilisée si généré).'
      );
    }
    if (!byCategory.has('collecte') && !byCategory.has('victoire')) {
      gaps.push('Aucune mécanique de collecte ou condition de victoire explicite n’a été observée.');
    }
    if (!byCategory.has('obstacle')) {
      gaps.push(
        'Aucun obstacle statique documenté : l’arène risque d’être trop ouverte sans paramétrage manuel.'
      );
    }
    if (!byCategory.has('defaite')) {
      gaps.push(
        'Aucune condition de défaite explicite observée (vies / limite de temps non documentées).'
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
    // Traçabilité globale plafonnée par la traçabilité réelle des observations
    const rawMechanicRatio =
      totalMechanicCount > 0 ? Math.round((sourcedMechanicCount / totalMechanicCount) * 100) : 0;
    const sourceTraceabilityRatio = Math.min(rawMechanicRatio, observationTraceabilityRatio);

    const hasCoreLoop =
      byCategory.has('deplacement') || byCategory.has('collecte') || byCategory.has('victoire');

    return {
      projectId: project.id,
      analyzedAt: new Date().toISOString(),
      canReconstruct: hasCoreLoop,
      refusalReason: hasCoreLoop
        ? undefined
        : 'Reconstruction bloquée : les observations fournies ne décrivent ni déplacement ni objectif de jeu exploitable.',
      detectedArchetype: hasCoreLoop ? 'arcade_arene_2d' : 'indetermine',
      extractedMechanics,
      contradictions,
      invalidSourceReferences,
      unsourcedObservationIds,
      controlBindings,
      gaps,
      v1Limitations: [...V1_KNOWN_LIMITATIONS],
      metrics: {
        sourceCount: sources.length,
        observationCount: observations.length,
        sourcedObservationCount,
        invalidSourceRefCount: invalidSourceReferences.length,
        observationTraceabilityRatio,
        sourcedMechanicCount,
        totalMechanicCount,
        sourceTraceabilityRatio,
      },
    };
  },
};

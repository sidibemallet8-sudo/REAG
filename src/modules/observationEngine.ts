import {
  GameObservation,
  ObservationCategory,
  ObservationConfidence,
} from '../types/reag';
import { createId } from '../utils/deterministic';

export interface CreateObservationInput {
  category: ObservationCategory;
  title: string;
  description: string;
  sourceId?: string;
  confidence: ObservationConfidence;
  parameters?: Record<string, string | number | boolean>;
  importedFrom?: string;
}

const VALID_CATEGORIES: ObservationCategory[] = [
  'deplacement',
  'collecte',
  'obstacle',
  'danger',
  'score',
  'victoire',
  'defaite',
  'controle',
  'physique',
];

const VALID_CONFIDENCES: ObservationConfidence[] = ['confirmee', 'deduite', 'incertaine'];

function inferCategoryFromText(text: string): ObservationCategory {
  const lower = text.toLowerCase();
  if (/(vitesse|bouge|déplace|deplace|marche|course|direction)/.test(lower)) return 'deplacement';
  if (/(collect|ramass|pièce|piece|éclat|eclat|objet|bonus|gemme)/.test(lower)) return 'collecte';
  if (/(mur|obstacle|bloc|cloison|paroi|solide)/.test(lower)) return 'obstacle';
  if (/(ennemi|sentinelle|danger|piège|piege|patrouille|dégât|degat|touche)/.test(lower))
    return 'danger';
  if (/(score|point|compteur|multiplicateur)/.test(lower)) return 'score';
  if (/(victoire|gagn|réussite|reussite|objectif atteint)/.test(lower)) return 'victoire';
  if (/(défaite|defaite|perdu|vie|mort|game over|chrono|temps écoulé)/.test(lower))
    return 'defaite';
  if (/(clavier|touche|zqsd|wasd|flèche|tactile|bouton|contrôle|controle)/.test(lower))
    return 'controle';
  return 'physique';
}

function extractInlineParameters(text: string): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  const speedMatch = text.match(/(\d+)\s*(?:px\/s|px\/sec)/i);
  if (speedMatch) params.speed = Number(speedMatch[1]);

  const pointsMatch = text.match(/(\d+)\s*(?:points?|pts)/i);
  if (pointsMatch) params.pointsPerItem = Number(pointsMatch[1]);

  const livesMatch = text.match(/(\d+)\s*(?:vies?|pv)/i);
  if (livesMatch) params.initialLives = Number(livesMatch[1]);

  const timeMatch = text.match(/(\d+)\s*(?:s|sec|secondes?)/i);
  if (timeMatch && /(chrono|temps|limite|minuteur|durée)/i.test(text)) {
    params.timeLimitSeconds = Number(timeMatch[1]);
  }

  return params;
}

export const ObservationEngine = {
  createObservation(input: CreateObservationInput): GameObservation {
    if (!input.title.trim()) {
      throw new Error("Le titre de l'observation est obligatoire.");
    }
    if (!input.description.trim()) {
      throw new Error("La description de l'observation est obligatoire.");
    }
    const category = VALID_CATEGORIES.includes(input.category)
      ? input.category
      : inferCategoryFromText(`${input.title} ${input.description}`);
    const confidence = VALID_CONFIDENCES.includes(input.confidence)
      ? input.confidence
      : 'deduite';

    return {
      id: createId('obs'),
      category,
      title: input.title.trim(),
      description: input.description.trim(),
      sourceId: input.sourceId || undefined,
      confidence,
      parameters: {
        ...extractInlineParameters(input.description),
        ...(input.parameters || {}),
      },
      importedFrom: input.importedFrom,
      createdAt: new Date().toISOString(),
    };
  },

  addObservation(
    observations: GameObservation[],
    input: CreateObservationInput
  ): GameObservation[] {
    const created = this.createObservation(input);
    return [created, ...observations];
  },

  removeObservation(observations: GameObservation[], id: string): GameObservation[] {
    return observations.filter((o) => o.id !== id);
  },

  parseImportedObservations(
    rawText: string,
    formatHint: 'auto' | 'json' | 'csv' | 'texte' = 'auto',
    originLabel = 'import-manuel'
  ): { observations: GameObservation[]; errors: string[] } {
    const trimmed = rawText.trim();
    if (!trimmed) {
      return {
        observations: [],
        errors: ['Le contenu à importer est vide.'],
      };
    }

    const errors: string[] = [];
    const results: GameObservation[] = [];

    const effectiveFormat =
      formatHint === 'auto'
        ? trimmed.startsWith('{') || trimmed.startsWith('[')
          ? 'json'
          : trimmed.includes(';') || /^category,|categorie,/i.test(trimmed)
          ? 'csv'
          : 'texte'
        : formatHint;

    if (effectiveFormat === 'json') {
      try {
        const parsed = JSON.parse(trimmed);
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        rows.forEach((row, index) => {
          if (typeof row !== 'object' || row === null) {
            errors.push(`Entrée JSON #${index + 1} ignorée : objet attendu.`);
            return;
          }
          const r = row as Record<string, unknown>;
          const title = String(r.title || r.titre || '').trim();
          const description = String(r.description || r.regle || '').trim();
          if (!title || !description) {
            errors.push(`Entrée JSON #${index + 1} ignorée : "title" et "description" requis.`);
            return;
          }
          const catRaw = String(r.category || r.categorie || '').toLowerCase() as ObservationCategory;
          const confRaw = String(
            r.confidence || r.confiance || 'deduite'
          ).toLowerCase() as ObservationConfidence;
          results.push(
            this.createObservation({
              category: VALID_CATEGORIES.includes(catRaw)
                ? catRaw
                : inferCategoryFromText(`${title} ${description}`),
              title,
              description,
              confidence: VALID_CONFIDENCES.includes(confRaw) ? confRaw : 'deduite',
              parameters:
                typeof r.parameters === 'object' && r.parameters !== null
                  ? (r.parameters as Record<string, string | number | boolean>)
                  : {},
              importedFrom: originLabel,
            })
          );
        });
      } catch {
        errors.push('Erreur de syntaxe JSON lors de l’importation des observations.');
      }
      return { observations: results, errors };
    }

    if (effectiveFormat === 'csv') {
      const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const separator = lines[0].includes(';') ? ';' : ',';
      const startIndex = /categorie|category|titre|title/i.test(lines[0]) ? 1 : 0;

      for (let i = startIndex; i < lines.length; i += 1) {
        const cols = lines[i].split(separator).map((c) => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 2) {
          errors.push(`Ligne CSV ${i + 1} ignorée : au moins 2 colonnes requises.`);
          continue;
        }
        const [maybeCat, maybeTitle, maybeDesc, maybeConf] =
          cols.length >= 3 ? cols : ['auto', cols[0], cols[1], 'deduite'];
        const title = maybeTitle || `Observation CSV #${i + 1}`;
        const description = maybeDesc || maybeTitle;
        const cat = maybeCat.toLowerCase() as ObservationCategory;
        const conf = (maybeConf || 'deduite').toLowerCase() as ObservationConfidence;

        results.push(
          this.createObservation({
            category: VALID_CATEGORIES.includes(cat)
              ? cat
              : inferCategoryFromText(`${title} ${description}`),
            title,
            description,
            confidence: VALID_CONFIDENCES.includes(conf) ? conf : 'deduite',
            importedFrom: originLabel,
          })
        );
      }
      return { observations: results, errors };
    }

    // Format texte structuré : chaque ligne non vide devient une observation
    const lines = trimmed
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean);

    lines.forEach((line, idx) => {
      const colonIdx = line.indexOf(':');
      const title =
        colonIdx > 2 && colonIdx < 56
          ? line.slice(0, colonIdx).trim()
          : `Observation importée #${idx + 1}`;
      const description = colonIdx > 2 && colonIdx < 56 ? line.slice(colonIdx + 1).trim() : line;
      if (!description) {
        errors.push(`Ligne ${idx + 1} ignorée : description vide.`);
        return;
      }
      results.push(
        this.createObservation({
          category: inferCategoryFromText(line),
          title,
          description,
          confidence: 'deduite',
          importedFrom: originLabel,
        })
      );
    });

    return { observations: results, errors };
  },
};

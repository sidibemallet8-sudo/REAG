import { GeminiProvider, type GeminiStatus } from './geminiProvider.ts';
import { OllamaProvider, type OllamaStatus } from './ollamaProvider.ts';

export type ProviderChoice = 'none' | 'ollama' | 'gemini';

export interface ValidatedAiProposal {
  category:
    | 'deplacement'
    | 'collecte'
    | 'obstacle'
    | 'danger'
    | 'score'
    | 'victoire'
    | 'defaite'
    | 'controle'
    | 'physique';
  title: string;
  description: string;
  rationale: string;
}

export interface OrchestratorResult {
  providerUsed: ProviderChoice;
  modelUsed: string | null;
  proposals: ValidatedAiProposal[];
  disclaimer: string;
  rawValidated: boolean;
}

export interface HybridAiStatus {
  ollama: OllamaStatus;
  gemini: GeminiStatus;
  noAiModeAvailable: true;
  ramAdvisory: string;
}

const ALLOWED_CATEGORIES = new Set([
  'deplacement',
  'collecte',
  'obstacle',
  'danger',
  'score',
  'victoire',
  'defaite',
  'controle',
  'physique',
]);

function parseAndValidateProposals(rawJson: string): ValidatedAiProposal[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("La réponse de l'IA n'est pas un JSON valide.");
  }

  const list =
    typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { proposals?: unknown }).proposals)
      ? (parsed as { proposals: unknown[] }).proposals
      : Array.isArray(parsed)
      ? parsed
      : null;

  if (!list) {
    throw new Error('Format de proposition IA invalide : tableau "proposals" attendu.');
  }

  const validated: ValidatedAiProposal[] = [];
  for (const item of list.slice(0, 8)) {
    if (typeof item !== 'object' || item === null) continue;
    const rec = item as Record<string, unknown>;
    const cat = String(rec.category || 'physique').toLowerCase();
    const title = typeof rec.title === 'string' ? rec.title.trim() : '';
    const description = typeof rec.description === 'string' ? rec.description.trim() : '';
    const rationale = typeof rec.rationale === 'string' ? rec.rationale.trim() : 'Proposition IA à vérifier';

    if (!title || !description) continue;
    validated.push({
      category: (ALLOWED_CATEGORIES.has(cat) ? cat : 'physique') as ValidatedAiProposal['category'],
      title: title.slice(0, 120),
      description: description.slice(0, 400),
      rationale: rationale.slice(0, 200),
    });
  }

  return validated;
}

export const AiOrchestrator = {
  async getHybridStatus(): Promise<HybridAiStatus> {
    const [ollama, gemini] = await Promise.all([
      OllamaProvider.getStatus(),
      Promise.resolve(GeminiProvider.getStatus()),
    ]);

    return {
      ollama,
      gemini,
      noAiModeAvailable: true,
      ramAdvisory:
        'PC 8 Go RAM : privilégiez le mode sans IA ou des modèles locaux légers (< 4 Go). Les modèles lourds peuvent saturer la mémoire.',
    };
  },

  async requestProposals(input: {
    provider: ProviderChoice;
    model?: string;
    projectName: string;
    notes: string;
  }): Promise<OrchestratorResult> {
    if (input.provider === 'none') {
      return {
        providerUsed: 'none',
        modelUsed: null,
        proposals: [],
        disclaimer:
          'Mode sans IA actif : REAG Core fonctionne de manière 100% autonome et déterministe.',
        rawValidated: true,
      };
    }

    const prompt = [
      `Projet : ${input.projectName}`,
      `Notes fournies par l'utilisateur : ${input.notes}`,
      'Retourne un objet JSON {"proposals":[{"category":"deplacement|collecte|obstacle|danger|score|victoire|defaite|controle|physique","title":"...","description":"...","rationale":"..."}]}.',
      'Ne produis jamais de code exécutable. Propose au maximum 4 observations concrètes en français.',
    ].join('\n');

    if (input.provider === 'ollama') {
      const raw = await OllamaProvider.generateStructuredProposal(input.model || '', prompt);
      const proposals = parseAndValidateProposals(raw);
      return {
        providerUsed: 'ollama',
        modelUsed: input.model || 'local-auto',
        proposals,
        disclaimer:
          'Propositions générées localement par Ollama et classées comme hypothèses par REAG Core jusqu’à validation humaine.',
        rawValidated: true,
      };
    }

    const raw = await GeminiProvider.generateStructuredProposal(prompt);
    const proposals = parseAndValidateProposals(raw);
    return {
      providerUsed: 'gemini',
      modelUsed: 'gemini-4-hydrogen',
      proposals,
      disclaimer:
        'Propositions générées par Gemini et classées comme hypothèses par REAG Core jusqu’à validation humaine.',
      rawValidated: true,
    };
  },

  async testProviderConnection(input: {
    provider: ProviderChoice;
    model?: string;
  }): Promise<{
    ok: boolean;
    provider: ProviderChoice;
    modelUsed: string | null;
    message: string;
    details?: Record<string, unknown>;
  }> {
    if (input.provider === 'none') {
      return {
        ok: true,
        provider: 'none',
        modelUsed: null,
        message: 'Mode sans IA opérationnel : REAG Core fonctionne de manière 100% locale et déterministe.',
      };
    }

    if (input.provider === 'ollama') {
      const res = await OllamaProvider.testConnection(input.model);
      return {
        ok: res.ok,
        provider: 'ollama',
        modelUsed: res.modelUsed,
        message: res.message,
        details: {
          installed: res.installed,
          serviceRunning: res.serviceRunning,
          models: res.models,
        },
      };
    }

    const res = await GeminiProvider.testConnection();
    return {
      ok: res.ok,
      provider: 'gemini',
      modelUsed: res.model,
      message: res.message,
      details: {
        configured: res.configured,
        errorType: res.errorType || null,
      },
    };
  },
};

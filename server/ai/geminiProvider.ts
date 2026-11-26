import { GoogleGenAI, Type } from '@google/genai';

export interface GeminiStatus {
  configured: boolean;
  model: string;
  message: string;
}

export interface GeminiConnectionTestResult {
  ok: boolean;
  configured: boolean;
  model: string;
  message: string;
  errorType?: 'missing_key' | 'auth_error' | 'quota_error' | 'api_error';
}

export interface GeminiClientLike {
  models: {
    generateContent(params: unknown): Promise<{ text?: string }>;
  };
}

const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

function defaultCreateClient(apiKey: string): GeminiClientLike {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  }) as unknown as GeminiClientLike;
}

export function mapGeminiApiError(err: unknown): {
  errorType: 'auth_error' | 'quota_error' | 'api_error';
  message: string;
} {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes('403') ||
    msg.includes('401') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('API_KEY_INVALID')
  ) {
    return {
      errorType: 'auth_error',
      message:
        'Clé Gemini refusée (401/403). Vérifiez votre clé dans le panneau Settings > Secrets.',
    };
  }
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    return {
      errorType: 'quota_error',
      message:
        'Quota Gemini dépassé (429). Réessayez plus tard ou utilisez le mode sans IA / Ollama.',
    };
  }
  return {
    errorType: 'api_error',
    message: `Erreur API Gemini : ${msg}`,
  };
}

export const GeminiProvider = {
  getStatus(): GeminiStatus {
    const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
    return {
      configured: hasKey,
      model: DEFAULT_GEMINI_MODEL,
      message: hasKey
        ? 'Clé serveur détectée (Settings > Secrets / environnement).'
        : 'Aucune clé GEMINI_API_KEY configurée côté serveur.',
    };
  },

  async testConnection(
    createClient: (apiKey: string) => GeminiClientLike = defaultCreateClient
  ): Promise<GeminiConnectionTestResult> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return {
        ok: false,
        configured: false,
        model: DEFAULT_GEMINI_MODEL,
        errorType: 'missing_key',
        message: 'Gemini non configuré : aucune clé GEMINI_API_KEY détectée côté serveur.',
      };
    }

    try {
      const ai = createClient(apiKey);
      const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: 'Réponds uniquement par {"ok":true}.',
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ok: { type: Type.BOOLEAN },
            },
          },
        },
      });
      const text = response.text?.trim();
      if (!text) {
        return {
          ok: false,
          configured: true,
          model: DEFAULT_GEMINI_MODEL,
          errorType: 'api_error',
          message: 'Réponse vide reçue depuis l’API Gemini.',
        };
      }
      return {
        ok: true,
        configured: true,
        model: DEFAULT_GEMINI_MODEL,
        message: `Connexion Gemini opérationnelle (${DEFAULT_GEMINI_MODEL}).`,
      };
    } catch (err) {
      const mapped = mapGeminiApiError(err);
      return {
        ok: false,
        configured: true,
        model: DEFAULT_GEMINI_MODEL,
        errorType: mapped.errorType,
        message: mapped.message,
      };
    }
  },

  async generateStructuredProposal(
    prompt: string,
    createClient: (apiKey: string) => GeminiClientLike = defaultCreateClient
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        'Gemini indisponible : aucune clé GEMINI_API_KEY n’est configurée côté serveur.'
      );
    }

    const ai = createClient(apiKey);

    try {
      const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            'Tu es un assistant de formalisation de mécaniques de jeu pour REAG. Propose uniquement des observations structurées en français, basées sur le contexte fourni, sans jamais prétendre valider un jeu complet.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              proposals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const text = response.text?.trim();
      if (!text) {
        throw new Error('Réponse Gemini vide.');
      }
      return text;
    } catch (err) {
      const mapped = mapGeminiApiError(err);
      throw new Error(mapped.message);
    }
  },
};

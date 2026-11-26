import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface OllamaStatus {
  installed: boolean;
  serviceRunning: boolean;
  baseUrl: string;
  models: string[];
  error: string | null;
}

export const OllamaProvider = {
  getBaseUrl(): string {
    return process.env.OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434';
  },

  async detectBinary(): Promise<boolean> {
    try {
      await execFileAsync('ollama', ['--version'], { timeout: 1500 });
      return true;
    } catch {
      return false;
    }
  },

  async getStatus(): Promise<OllamaStatus> {
    const baseUrl = this.getBaseUrl();
    const installed = await this.detectBinary();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1400);
    try {
      const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        return {
          installed,
          serviceRunning: false,
          baseUrl,
          models: [],
          error: `Service Ollama a répondu HTTP ${res.status}.`,
        };
      }
      const data = (await res.json()) as { models?: Array<{ name?: string }> };
      const models = Array.isArray(data.models)
        ? data.models.map((m) => m.name).filter((n): n is string => Boolean(n))
        : [];
      return {
        installed: true,
        serviceRunning: true,
        baseUrl,
        models,
        error:
          models.length === 0
            ? 'Ollama est démarré mais aucun modèle local n’est installé (aucun téléchargement automatique effectué).'
            : null,
      };
    } catch {
      clearTimeout(timer);
      return {
        installed,
        serviceRunning: false,
        baseUrl,
        models: [],
        error: installed
          ? 'Ollama est installé mais le service local (127.0.0.1:11434) n’est pas démarré.'
          : 'Ollama n’est pas détecté sur cette machine.',
      };
    }
  },

  async generateStructuredProposal(model: string, prompt: string): Promise<string> {
    const status = await this.getStatus();
    if (!status.serviceRunning) {
      throw new Error(status.error || 'Service Ollama indisponible.');
    }
    if (status.models.length === 0) {
      throw new Error('Aucun modèle Ollama installé localement.');
    }
    const targetModel = model && status.models.includes(model) ? model : status.models[0];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch(`${status.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: targetModel,
          prompt,
          format: 'json',
          stream: false,
          options: {
            num_predict: 700,
          },
        }),
      });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`Erreur Ollama HTTP ${res.status}`);
      }
      const payload = (await res.json()) as { response?: string };
      if (!payload.response) {
        throw new Error('Réponse Ollama vide.');
      }
      return payload.response;
    } catch (err) {
      clearTimeout(timer);
      throw new Error(
        err instanceof Error ? err.message : 'Échec de requête vers Ollama.'
      );
    }
  },

  async testConnection(model?: string): Promise<{
    ok: boolean;
    installed: boolean;
    serviceRunning: boolean;
    modelUsed: string | null;
    models: string[];
    message: string;
  }> {
    const status = await this.getStatus();
    if (!status.serviceRunning) {
      return {
        ok: false,
        installed: status.installed,
        serviceRunning: false,
        modelUsed: null,
        models: [],
        message: status.error || 'Service Ollama non démarré.',
      };
    }
    if (status.models.length === 0) {
      return {
        ok: false,
        installed: status.installed,
        serviceRunning: true,
        modelUsed: null,
        models: [],
        message:
          'Service Ollama actif, mais aucun modèle local disponible (aucun téléchargement automatique effectué).',
      };
    }

    const targetModel = model && status.models.includes(model) ? model : status.models[0];
    try {
      const raw = await this.generateStructuredProposal(
        targetModel,
        'Retourne uniquement le JSON {"ok":true}.'
      );
      JSON.parse(raw);
      return {
        ok: true,
        installed: status.installed,
        serviceRunning: true,
        modelUsed: targetModel,
        models: status.models,
        message: `Ollama opérationnel avec le modèle local "${targetModel}".`,
      };
    } catch (err) {
      return {
        ok: false,
        installed: status.installed,
        serviceRunning: status.serviceRunning,
        modelUsed: targetModel,
        models: status.models,
        message:
          err instanceof Error
            ? `Échec du test de génération Ollama : ${err.message}`
            : 'Échec du test Ollama.',
      };
    }
  },
};

import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AiOrchestrator, type ProviderChoice } from './ai/aiOrchestrator.ts';
import {
  assertNoForbiddenKeys,
  localAccessGuard,
  sanitizeProjectId,
} from './config/security.ts';
import { LocalProjectStore, type StoredProjectRecord } from './services/localProjectStore.ts';
import { findAvailablePort } from './services/portManager.ts';
import { PreviewManager } from './services/previewManager.ts';

export interface ReagHostContext {
  app: express.Express;
  store: LocalProjectStore;
  previewManager: PreviewManager;
  startedAt: string;
  closeAll: () => Promise<void>;
}

export function createReagLocalHostApp(options?: {
  dataDir?: string;
  previewPreferredPort?: number;
  host?: string;
  port?: number;
  onShutdownRequested?: () => void;
}): ReagHostContext {
  const startedAt = new Date().toISOString();
  const dataDir = options?.dataDir || path.resolve(process.cwd(), 'data');
  const store = new LocalProjectStore(dataDir);
  const previewManager = new PreviewManager(store, options?.previewPreferredPort || 4174);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '4mb' }));
  app.use('/api', localAccessGuard);

  app.get('/api/health', (_, res) => {
    res.json({
      ok: true,
      service: 'REAG Local Host',
      startedAt,
      pid: process.pid,
      host: options?.host || '127.0.0.1',
      port: options?.port ?? null,
      preview: previewManager.getStatus(),
    });
  });

  app.get('/api/services/status', async (_, res) => {
    try {
      const ai = await AiOrchestrator.getHybridStatus();
      const totalMemGb = Number((os.totalmem() / 1024 ** 3).toFixed(1));
      const freeMemGb = Number((os.freemem() / 1024 ** 3).toFixed(1));
      res.json({
        localHost: {
          running: true,
          host: options?.host || '127.0.0.1',
          port: options?.port ?? null,
          startedAt,
          dataDir,
          projectCount: store.listProjects().length,
        },
        preview: previewManager.getStatus(),
        ai,
        system: {
          platform: process.platform,
          nodeVersion: process.version,
          totalMemGb,
          freeMemGb,
          compatible8GbProfile: totalMemGb <= 9,
        },
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erreur lecture état des services.',
      });
    }
  });

  app.get('/api/ports/check', async (req, res) => {
    const preferred = Number(req.query.preferred || 4174);
    try {
      const port = await findAvailablePort(preferred, '127.0.0.1', 30);
      res.json({ preferred, availablePort: port });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Vérification de port impossible.',
      });
    }
  });

  // Projets locaux sur disque
  app.get('/api/projects', (_, res) => {
    res.json({ projects: store.listProjects() });
  });

  app.get('/api/projects/:id', (req, res) => {
    try {
      const id = sanitizeProjectId(req.params.id);
      const proj = store.getProject(id);
      if (!proj) {
        res.status(404).json({ error: 'Projet introuvable.' });
        return;
      }
      res.json({ project: proj });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Requête invalide.' });
    }
  });

  app.post('/api/projects', (req, res) => {
    try {
      assertNoForbiddenKeys(req.body);
      const saved = store.saveProject(req.body as StoredProjectRecord);
      res.status(201).json({ project: saved });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Création impossible.' });
    }
  });

  app.put('/api/projects/:id', (req, res) => {
    try {
      const id = sanitizeProjectId(req.params.id);
      assertNoForbiddenKeys(req.body);
      const body = req.body as StoredProjectRecord;
      if (body.id && body.id !== id) {
        res.status(400).json({ error: 'L’identifiant du corps ne correspond pas à l’URL.' });
        return;
      }
      const saved = store.saveProject({ ...body, id });
      res.json({ project: saved });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Sauvegarde impossible.' });
    }
  });

  app.patch('/api/projects/:id/rename', (req, res) => {
    try {
      const id = sanitizeProjectId(req.params.id);
      assertNoForbiddenKeys(req.body);
      const name = (req.body as { name?: unknown }).name;
      if (typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Le nouveau nom est requis.' });
        return;
      }
      const renamed = store.renameProject(id, name);
      res.json({ project: renamed });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Renommage impossible.' });
    }
  });

  app.post('/api/projects/:id/duplicate', (req, res) => {
    try {
      const id = sanitizeProjectId(req.params.id);
      const cloned = store.duplicateProject(id);
      res.status(201).json({ project: cloned });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Duplication impossible.' });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const id = sanitizeProjectId(req.params.id);
      if (previewManager.getStatus().projectId === id) {
        await previewManager.stopPreview();
      }
      store.deleteProject(id);
      res.json({ ok: true, deletedId: id });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Suppression impossible.' });
    }
  });

  // Preview Manager (2ème port local)
  app.get('/api/preview/status', (_, res) => {
    res.json({ preview: previewManager.getStatus() });
  });

  app.post('/api/preview/start', async (req, res) => {
    try {
      assertNoForbiddenKeys(req.body);
      const { projectId, openBrowser } = req.body as {
        projectId?: string;
        openBrowser?: boolean;
      };
      const status = await previewManager.startPreview(
        projectId || '',
        Boolean(openBrowser)
      );
      res.json({ preview: status });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Impossible de démarrer l'aperçu.",
      });
    }
  });

  app.post('/api/preview/stop', async (_, res) => {
    const status = await previewManager.stopPreview();
    res.json({ preview: status });
  });

  // IA Hybride (Ollama local + Gemini serveur + Sans IA)
  app.get('/api/ai/status', async (_, res) => {
    const status = await AiOrchestrator.getHybridStatus();
    res.json(status);
  });

  app.post('/api/ai/test', async (req, res) => {
    try {
      assertNoForbiddenKeys(req.body);
      const body = (req.body || {}) as { provider?: ProviderChoice; model?: string };
      const provider: ProviderChoice =
        body.provider === 'ollama' || body.provider === 'gemini' ? body.provider : 'none';
      const result = await AiOrchestrator.testProviderConnection({
        provider,
        model: typeof body.model === 'string' ? body.model : undefined,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Erreur lors du test fournisseur IA.',
      });
    }
  });

  app.post('/api/ai/propose', async (req, res) => {
    try {
      assertNoForbiddenKeys(req.body);
      const body = req.body as {
        provider?: ProviderChoice;
        model?: string;
        projectName?: string;
        notes?: string;
      };
      const provider: ProviderChoice =
        body.provider === 'ollama' || body.provider === 'gemini' ? body.provider : 'none';
      const result = await AiOrchestrator.requestProposals({
        provider,
        model: typeof body.model === 'string' ? body.model : undefined,
        projectName: typeof body.projectName === 'string' ? body.projectName : 'Projet REAG',
        notes: typeof body.notes === 'string' ? body.notes : '',
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Erreur fournisseur IA.',
      });
    }
  });

  app.post('/api/launcher/shutdown', async (_, res) => {
    res.json({ ok: true, message: 'Arrêt propre de REAG Local Host planifié.' });
    if (options?.onShutdownRequested) {
      setTimeout(() => options.onShutdownRequested?.(), 80);
    }
  });

  // Vérification existence dossier data
  fs.mkdirSync(dataDir, { recursive: true });

  return {
    app,
    store,
    previewManager,
    startedAt,
    closeAll: async () => {
      await previewManager.stopPreview();
    },
  };
}

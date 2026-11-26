import express from 'express';
import http from 'node:http';
import type { Socket } from 'node:net';
import { openUrlInBrowser } from '../../launcher/chromeFinder.ts';
import { localAccessGuard, resolveSafePath, sanitizeProjectId } from '../config/security.ts';
import { LocalProjectStore } from './localProjectStore.ts';
import { findAvailablePort } from './portManager.ts';

export interface PreviewStatus {
  running: boolean;
  projectId: string | null;
  projectName: string | null;
  port: number | null;
  url: string | null;
  startedAt: string | null;
  browserLaunchMessage: string | null;
  lastError: string | null;
}

export class PreviewManager {
  store: LocalProjectStore;
  preferredPort: number;
  server: http.Server | null;
  sockets: Set<Socket>;
  status: PreviewStatus;

  constructor(store: LocalProjectStore, preferredPort = 4174) {
    this.store = store;
    this.preferredPort = preferredPort;
    this.server = null;
    this.sockets = new Set();
    this.status = {
      running: false,
      projectId: null,
      projectName: null,
      port: null,
      url: null,
      startedAt: null,
      browserLaunchMessage: null,
      lastError: null,
    };
  }

  getStatus(): PreviewStatus {
    return { ...this.status };
  }

  private async waitUntilReady(url: string, timeoutMs = 4000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(url);
        if (res.ok) return;
      } catch {
        // Attendre que le serveur écoute
      }
      await new Promise((r) => setTimeout(r, 80));
    }
    throw new Error(`Le serveur d'aperçu n'a pas répondu à temps sur ${url}.`);
  }

  async startPreview(
    rawProjectId: string,
    openBrowser = false
  ): Promise<PreviewStatus> {
    const projectId = sanitizeProjectId(rawProjectId);
    const project = this.store.getProject(projectId);
    if (!project) {
      throw new Error(`Projet "${projectId}" introuvable sur le disque.`);
    }

    const previewDir = this.store.getPreviewDir(projectId);
    const indexPath = resolveSafePath(previewDir, 'index.html');
    if (!this.store.hasPreviewIndex(projectId)) {
      throw new Error(
        `Fichier d'aperçu introuvable (${indexPath}). Générez d'abord le jeu dans l'éditeur.`
      );
    }

    // Arrêter proprement un aperçu précédent si actif
    if (this.server) {
      await this.stopPreview();
    }

    const port = await findAvailablePort(this.preferredPort, '127.0.0.1', 30);
    const app = express();

    app.disable('x-powered-by');
    app.use(localAccessGuard);
    app.use((_, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      next();
    });

    // Sert exclusivement le dossier preview du projet ciblé
    app.use(express.static(previewDir, { dotfiles: 'deny', index: ['index.html'] }));
    app.get('/', (_, res) => {
      res.sendFile(indexPath);
    });

    const server = http.createServer(app);
    this.sockets.clear();
    server.on('connection', (socket) => {
      this.sockets.add(socket);
      socket.on('close', () => {
        this.sockets.delete(socket);
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolve();
      });
    });

    this.server = server;
    const url = `http://127.0.0.1:${port}/`;

    try {
      await this.waitUntilReady(url, 4000);
    } catch (err) {
      await this.stopPreview();
      throw err;
    }

    let browserMsg: string | null = null;
    if (openBrowser) {
      const launchRes = openUrlInBrowser(url);
      browserMsg = launchRes.message;
    }

    this.status = {
      running: true,
      projectId,
      projectName: project.name,
      port,
      url,
      startedAt: new Date().toISOString(),
      browserLaunchMessage: browserMsg,
      lastError: null,
    };

    return this.getStatus();
  }

  async stopPreview(): Promise<PreviewStatus> {
    if (this.server) {
      const srv = this.server;
      this.server = null;
      for (const socket of this.sockets) {
        socket.destroy();
      }
      this.sockets.clear();
      await new Promise<void>((resolve) => {
        srv.close(() => resolve());
      });
    }

    this.status = {
      running: false,
      projectId: null,
      projectName: null,
      port: null,
      url: null,
      startedAt: null,
      browserLaunchMessage: null,
      lastError: null,
    };

    return this.getStatus();
  }
}

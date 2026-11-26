import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReagLocalHostApp } from './server/app.ts';
import { getBindHost } from './server/config/security.ts';
import { findAvailablePort } from './server/services/portManager.ts';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

async function startServer(): Promise<void> {
  const host = getBindHost();
  const preferredPort = Number(
    process.env.PORT || (process.env.REAG_LOCAL_MODE === 'true' ? 4173 : 3000)
  );
  const useAutoPort = process.env.REAG_AUTO_PORT === 'true';
  const port = useAutoPort ? await findAvailablePort(preferredPort, host, 30) : preferredPort;

  const resourcesDir = path.resolve(process.env.REAG_RESOURCES_DIR || serverDir);
  const dataDir = path.resolve(process.env.REAG_DATA_DIR || path.join(process.cwd(), 'data'));

  let httpServer: http.Server | null = null;
  let shuttingDown = false;

  const performShutdown = async (exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const forceTimer = setTimeout(() => {
      process.exit(exitCode);
    }, 1500);
    forceTimer.unref();

    try {
      await hostCtx.closeAll();
    } catch {
      // Ignore cleanup error during shutdown
    }
    if (httpServer) {
      httpServer.close(() => {
        clearTimeout(forceTimer);
        process.exit(exitCode);
      });
    } else {
      clearTimeout(forceTimer);
      process.exit(exitCode);
    }
  };

  const hostCtx = createReagLocalHostApp({
    dataDir,
    previewPreferredPort: Number(process.env.REAG_PREVIEW_PORT || 4174),
    host,
    port,
    onShutdownRequested: () => {
      void performShutdown(0);
    },
  });

  const serveStaticDist =
    process.env.NODE_ENV === 'production' || process.env.REAG_SERVE_STATIC === 'true';

  if (serveStaticDist) {
    const distDir = path.join(resourcesDir, 'dist');
    if (fs.existsSync(distDir)) {
      hostCtx.app.use(express.static(distDir));
      hostCtx.app.get(/^(?!\/api).*/, (_, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    } else {
      throw new Error(`Dossier frontend compilé introuvable : ${distDir}`);
    }
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    hostCtx.app.use(vite.middlewares);
  }

  httpServer = http.createServer(hostCtx.app);
  httpServer.on('error', (err) => {
    console.error(`[REAG Local Host] Erreur serveur sur ${host}:${port} :`, err.message);
    void performShutdown(1);
  });

  process.on('SIGINT', () => {
    void performShutdown(0);
  });
  process.on('SIGTERM', () => {
    void performShutdown(0);
  });

  httpServer.listen(port, host, () => {
    console.log(`[REAG Local Host] Prêt sur http://${host}:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[REAG Local Host] Erreur critique au démarrage :', err);
  process.exit(1);
});

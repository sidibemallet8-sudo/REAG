import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findAvailablePort } from '../server/services/portManager.ts';
import { openUrlInBrowser } from './chromeFinder.ts';

export interface LauncherLockRecord {
  pid: number;
  url: string;
  port: number;
  startedAt: string;
}

function appendLauncherLog(dataDir: string, message: string): void {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const logPath = path.join(dataDir, 'launcher.log');
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(logPath, line, 'utf-8');
  } catch {
    // Ignore logging errors
  }
}

export function resolveResourcesDir(rootDir: string): string {
  const packagedResources = path.join(rootDir, 'resources');
  if (fs.existsSync(path.join(packagedResources, 'server.ts'))) {
    return packagedResources;
  }
  return rootDir;
}

export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function checkExistingInstance(
  lockPath: string
): Promise<LauncherLockRecord | null> {
  if (!fs.existsSync(lockPath)) return null;
  try {
    const raw = fs.readFileSync(lockPath, 'utf-8');
    const parsed = JSON.parse(raw) as LauncherLockRecord;
    if (!parsed || typeof parsed.pid !== 'number' || typeof parsed.url !== 'string') {
      return null;
    }
    if (!isProcessAlive(parsed.pid)) {
      fs.unlinkSync(lockPath);
      return null;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1400);
    try {
      const res = await fetch(`${parsed.url}/api/health`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const payload = (await res.json()) as { ok?: boolean; service?: string };
        if (payload.ok && payload.service === 'REAG Local Host') {
          return parsed;
        }
      }
    } catch {
      clearTimeout(timer);
    }
    return null;
  } catch {
    return null;
  }
}

export function writeLauncherLock(lockPath: string, record: LauncherLockRecord): void {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, JSON.stringify(record, null, 2), 'utf-8');
}

export function releaseLauncherLock(lockPath: string): void {
  try {
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  } catch {
    // Ignore cleanup error
  }
}

export async function waitForServerHealth(
  url: string,
  child: ChildProcess,
  timeoutMs = 15000
): Promise<void> {
  const start = Date.now();
  let exitedEarly: string | null = null;

  const onExit = (code: number | null, signal: string | null) => {
    exitedEarly = `Le processus serveur s’est arrêté prématurément (code=${code}, signal=${signal}).`;
  };
  child.once('exit', onExit);

  try {
    while (Date.now() - start < timeoutMs) {
      if (exitedEarly) {
        throw new Error(exitedEarly);
      }
      try {
        const res = await fetch(`${url}/api/health`);
        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean; service?: string };
          if (data.ok && data.service === 'REAG Local Host') return;
        }
      } catch {
        // Attendre que le serveur écoute
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`Délai dépassé : REAG Local Host n’a pas répondu sur ${url}.`);
  } finally {
    child.removeListener('exit', onExit);
  }
}

export async function runLauncher(options?: {
  rootDir?: string;
  noBrowser?: boolean;
  preferredPort?: number;
  onChildExit?: (code: number | null, signal: string | null) => void;
}): Promise<{
  alreadyRunning: boolean;
  url: string;
  port: number;
  childPid?: number;
  stop?: () => Promise<void>;
}> {
  const launcherFileDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultRoot =
    path.basename(path.resolve(launcherFileDir, '..')) === 'resources'
      ? path.resolve(launcherFileDir, '..', '..')
      : path.resolve(launcherFileDir, '..');

  const rootDir = path.resolve(options?.rootDir || defaultRoot);
  const resourcesDir = resolveResourcesDir(rootDir);
  const dataDir = path.resolve(process.env.REAG_DATA_DIR || path.join(rootDir, 'data'));
  const lockPath = path.join(dataDir, 'reag.lock.json');

  // 1. Détecter une instance déjà lancée
  const existing = await checkExistingInstance(lockPath);
  if (existing) {
    const msg = `Instance déjà active sur ${existing.url} (PID ${existing.pid}).`;
    console.log(`[REAG Launcher] ${msg}`);
    appendLauncherLog(dataDir, msg);
    if (!options?.noBrowser) {
      const openRes = openUrlInBrowser(existing.url);
      console.log(`[REAG Launcher] ${openRes.message}`);
      appendLauncherLog(dataDir, openRes.message);
    }
    return { alreadyRunning: true, url: existing.url, port: existing.port };
  }

  // 2. Vérifier les ressources et le frontend compilé
  const serverEntry = path.join(resourcesDir, 'server.ts');
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Point d'entrée serveur introuvable : ${serverEntry}`);
  }

  const distIndex = path.join(resourcesDir, 'dist', 'index.html');
  const serveStatic = fs.existsSync(distIndex);
  if (!serveStatic) {
    console.warn(
      '[REAG Launcher] dist/index.html absent : démarrage avec Vite middleware de développement.'
    );
  }

  // 3. Réserver deux ports libres sur 127.0.0.1
  const studioPort = await findAvailablePort(options?.preferredPort || 4173, '127.0.0.1', 30);
  const previewPort = await findAvailablePort(studioPort + 1, '127.0.0.1', 30);
  const url = `http://127.0.0.1:${studioPort}`;

  appendLauncherLog(
    dataDir,
    `Démarrage REAG Local Host sur ${url} (preview=${previewPort}, static=${serveStatic}).`
  );

  // 4. Démarrer REAG Local Host via le binaire Node courant (portable ou système)
  const child = spawn(process.execPath, [serverEntry], {
    cwd: resourcesDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: {
      ...process.env,
      REAG_LOCAL_MODE: 'true',
      REAG_SERVE_STATIC: serveStatic ? 'true' : 'false',
      REAG_RESOURCES_DIR: resourcesDir,
      REAG_DATA_DIR: dataDir,
      PORT: String(studioPort),
      REAG_PREVIEW_PORT: String(previewPort),
    },
  });

  child.stdout?.on('data', (chunk) => {
    const text = String(chunk);
    process.stdout.write(text);
    appendLauncherLog(dataDir, `[stdout] ${text.trim()}`);
  });
  child.stderr?.on('data', (chunk) => {
    const text = String(chunk);
    process.stderr.write(text);
    appendLauncherLog(dataDir, `[stderr] ${text.trim()}`);
  });

  writeLauncherLock(lockPath, {
    pid: child.pid || process.pid,
    url,
    port: studioPort,
    startedAt: new Date().toISOString(),
  });

  const cleanup = async () => {
    releaseLauncherLock(lockPath);
    if (!child.killed && child.exitCode === null) {
      child.kill('SIGTERM');
    }
  };

  try {
    await waitForServerHealth(url, child, 15000);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    appendLauncherLog(dataDir, `[ERREUR] ${errMsg}`);
    await cleanup();
    throw err;
  }

  child.on('exit', (code, signal) => {
    releaseLauncherLock(lockPath);
    appendLauncherLog(dataDir, `Serveur arrêté (code=${code}, signal=${signal}).`);
    options?.onChildExit?.(code, signal);
  });

  console.log(`[REAG Launcher] REAG Studio prêt sur ${url}`);
  appendLauncherLog(dataDir, `REAG Studio prêt sur ${url}`);
  if (!options?.noBrowser) {
    const openRes = openUrlInBrowser(url);
    console.log(`[REAG Launcher] ${openRes.message}`);
    appendLauncherLog(dataDir, openRes.message);
  }

  return {
    alreadyRunning: false,
    url,
    port: studioPort,
    childPid: child.pid,
    stop: cleanup,
  };
}

const isCliEntry =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isCliEntry) {
  const noBrowser = process.argv.includes('--no-browser');
  runLauncher({
    noBrowser,
    onChildExit: (code) => {
      process.exit(code ?? 0);
    },
  })
    .then((res) => {
      if (res.alreadyRunning) {
        process.exit(0);
      }
      const handleSignal = async () => {
        console.log('\n[REAG Launcher] Arrêt propre en cours...');
        await res.stop?.();
        process.exit(0);
      };
      process.on('SIGINT', () => void handleSignal());
      process.on('SIGTERM', () => void handleSignal());
    })
    .catch((err) => {
      console.error('[REAG Launcher] Échec au démarrage :', err);
      process.exit(1);
    });
}

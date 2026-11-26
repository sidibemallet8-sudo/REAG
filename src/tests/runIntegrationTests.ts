import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { openUrlInBrowser } from '../../launcher/chromeFinder.ts';
import { runLauncher } from '../../launcher/reag-launcher.ts';
import { AiOrchestrator } from '../../server/ai/aiOrchestrator.ts';
import { GeminiProvider } from '../../server/ai/geminiProvider.ts';
import { OllamaProvider } from '../../server/ai/ollamaProvider.ts';
import { createReagLocalHostApp } from '../../server/app.ts';
import { findAvailablePort } from '../../server/services/portManager.ts';
import { createSampleProject } from '../data/sampleProject.ts';
import { GameAnalysisEngine } from '../modules/analysisEngine.ts';
import { GameGenerator } from '../modules/gameGenerator.ts';
import { SpecificationEngine } from '../modules/specificationEngine.ts';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

interface IntegrationResult {
  name: string;
  passed: boolean;
  details: string;
  error?: string;
}

async function runCase(name: string, fn: () => Promise<string>): Promise<IntegrationResult> {
  try {
    const details = await fn();
    return { name, passed: true, details };
  } catch (err) {
    return {
      name,
      passed: false,
      details: 'Échec',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const results: IntegrationResult[] = [];
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reag-v2-int-'));
  const tempDataDir = path.join(tempRoot, 'data-host');
  const prevLocalMode = process.env.REAG_LOCAL_MODE;
  const prevOllamaUrl = process.env.OLLAMA_BASE_URL;
  const prevGeminiKey = process.env.GEMINI_API_KEY;

  try {
    const sample = createSampleProject();
    const analysis = GameAnalysisEngine.analyzeProject(sample);
    const spec = SpecificationEngine.buildSpecification(sample, analysis);
    const artifact = GameGenerator.generateGame(spec);
    sample.analysis = analysis;
    sample.specification = spec;
    sample.generatedArtifact = artifact;

    const hostPort = await findAvailablePort(4185, '127.0.0.1', 40);
    const previewPreferred = await findAvailablePort(hostPort + 1, '127.0.0.1', 40);
    process.env.REAG_LOCAL_MODE = 'true';

    const ctx = createReagLocalHostApp({
      dataDir: tempDataDir,
      previewPreferredPort: previewPreferred,
      host: '127.0.0.1',
      port: hostPort,
    });

    const server = await new Promise<http.Server>((resolve) => {
      const s = ctx.app.listen(hostPort, '127.0.0.1', () => resolve(s));
    });
    const baseUrl = `http://127.0.0.1:${hostPort}`;

    try {
      results.push(
        await runCase('local_host_health_and_services', async () => {
          const healthRes = await fetch(`${baseUrl}/api/health`);
          assert(healthRes.status === 200, `Attendu 200, obtenu ${healthRes.status}`);
          const health = (await healthRes.json()) as {
            ok: boolean;
            service: string;
            host: string;
          };
          assert(
            health.ok && health.service === 'REAG Local Host' && health.host === '127.0.0.1',
            'Health check invalide.'
          );

          const svcRes = await fetch(`${baseUrl}/api/services/status`);
          assert(svcRes.status === 200, 'services/status doit répondre 200.');
          const svc = (await svcRes.json()) as { ai: { noAiModeAvailable: boolean } };
          assert(svc.ai.noAiModeAvailable === true, 'Mode sans IA absent.');
          return `REAG Local Host actif sur ${baseUrl}`;
        })
      );

      results.push(
        await runCase('project_disk_crud_and_reload', async () => {
          const saveRes = await fetch(`${baseUrl}/api/projects/${sample.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sample),
          });
          assert(saveRes.status === 200, 'Échec PUT projet.');

          const renameRes = await fetch(`${baseUrl}/api/projects/${sample.id}/rename`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Projet Disque Renommé' }),
          });
          assert(renameRes.status === 200, 'Échec PATCH rename.');

          const dupRes = await fetch(`${baseUrl}/api/projects/${sample.id}/duplicate`, {
            method: 'POST',
          });
          assert(dupRes.status === 201, 'Échec POST duplicate.');
          const dupPayload = (await dupRes.json()) as { project: { id: string } };

          const listRes = await fetch(`${baseUrl}/api/projects`);
          const listPayload = (await listRes.json()) as { projects: Array<{ id: string }> };
          assert(
            listPayload.projects.length === 2,
            `Attendu 2 projets, obtenu ${listPayload.projects.length}.`
          );

          const delRes = await fetch(`${baseUrl}/api/projects/${dupPayload.project.id}`, {
            method: 'DELETE',
          });
          assert(delRes.status === 200, 'Échec DELETE duplicate.');
          return 'Sauvegarde disque, renommage, duplication, rechargement et suppression vérifiés.';
        })
      );

      results.push(
        await runCase('security_traversal_origin_and_browser_guard', async () => {
          const badTraversal = await fetch(`${baseUrl}/api/projects/..%2Fetc%2Fpasswd`);
          assert(
            badTraversal.status === 400,
            `Traversal doit retourner 400 (obtenu ${badTraversal.status}).`
          );

          const badProto = await fetch(`${baseUrl}/api/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{"__proto__":{"x":1},"id":"proj_bad","name":"Bad"}',
          });
          assert(
            badProto.status === 400,
            `Clé __proto__ doit retourner 400 (obtenu ${badProto.status}).`
          );

          const badOrigin = await fetch(`${baseUrl}/api/health`, {
            headers: { Origin: 'https://evil.example' },
          });
          assert(
            badOrigin.status === 403,
            `Origine externe doit retourner 403 (obtenu ${badOrigin.status}).`
          );

          const blockedExternalUrl = openUrlInBrowser('https://evil.example/payload');
          assert(!blockedExternalUrl.launched, 'openUrlInBrowser ne doit autoriser que localhost.');
          return 'Traversal, __proto__, Origin externe (403) et ouverture URL externe bloqués.';
        })
      );

      results.push(
        await runCase('preview_manager_start_serve_stop_and_missing_html_error', async () => {
          const startRes = await fetch(`${baseUrl}/api/preview/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: sample.id, openBrowser: false }),
          });
          assert(startRes.status === 200, 'Échec démarrage preview.');
          const started = (await startRes.json()) as {
            preview: { running: boolean; url: string; port: number };
          };
          assert(
            started.preview.running && started.preview.url.startsWith('http://127.0.0.1:'),
            'URL preview invalide.'
          );

          const htmlRes = await fetch(started.preview.url);
          assert(
            htmlRes.status === 200,
            `Serveur preview n’a pas servi index.html (status ${htmlRes.status}).`
          );
          const htmlBody = await htmlRes.text();
          assert(
            htmlBody.includes('<canvas'),
            'Le HTML servi par preview ne contient pas le canvas du jeu.'
          );

          const stopRes = await fetch(`${baseUrl}/api/preview/stop`, { method: 'POST' });
          const stopped = (await stopRes.json()) as { preview: { running: boolean } };
          assert(!stopped.preview.running, 'Preview aurait dû être arrêté.');

          const blankProj = {
            id: 'proj_no_html',
            name: 'Sans HTML',
            sources: [],
            observations: [],
          };
          await fetch(`${baseUrl}/api/projects/proj_no_html`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(blankProj),
          });
          const errPreviewRes = await fetch(`${baseUrl}/api/preview/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: 'proj_no_html', openBrowser: false }),
          });
          assert(
            errPreviewRes.status === 400,
            'Preview sans HTML généré doit retourner HTTP 400.'
          );
          return `Preview servi sur ${started.preview.url}, arrêté proprement, et erreur explicite sur projet sans HTML.`;
        })
      );

      // --- §7 : 7 tests distincts d'IA hybride ---
      results.push(
        await runCase('ai_test_no_ai_mode', async () => {
          const testRes = await AiOrchestrator.testProviderConnection({ provider: 'none' });
          assert(testRes.ok && testRes.provider === 'none', 'Test mode sans IA échoué.');

          const apiTestRes = await fetch(`${baseUrl}/api/ai/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'none' }),
          });
          assert(apiTestRes.status === 200, '/api/ai/test en mode none doit répondre 200.');
          return 'Mode sans IA déterministe vérifié via orchestrateur et /api/ai/test.';
        })
      );

      results.push(
        await runCase('ai_test_ollama_running_and_local_model_available', async () => {
          const ollamaPort = await findAvailablePort(11490, '127.0.0.1', 30);
          const mockOllama = http.createServer((req, res) => {
            if (req.url === '/api/tags' && req.method === 'GET') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ models: [{ name: 'qwen2.5:3b' }, { name: 'llama3.2:3b' }] }));
              return;
            }
            if (req.url === '/api/generate' && req.method === 'POST') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  response: JSON.stringify({
                    proposals: [
                      {
                        category: 'deplacement',
                        title: 'Vitesse test Ollama',
                        description: 'Vitesse 220 px/s',
                        rationale: 'Test serveur Ollama local',
                      },
                    ],
                  }),
                })
              );
              return;
            }
            res.writeHead(404).end();
          });
          await new Promise<void>((resolve) => mockOllama.listen(ollamaPort, '127.0.0.1', resolve));
          try {
            process.env.OLLAMA_BASE_URL = `http://127.0.0.1:${ollamaPort}`;
            const status = await OllamaProvider.getStatus();
            assert(
              status.serviceRunning && status.models.includes('qwen2.5:3b'),
              'Ollama simulé non détecté avec modèle local.'
            );
            const conn = await OllamaProvider.testConnection('qwen2.5:3b');
            assert(
              conn.ok && conn.modelUsed === 'qwen2.5:3b',
              `Test connexion Ollama échoué : ${conn.message}`
            );
            return `Service Ollama et modèle local ${conn.modelUsed} vérifiés sur http://127.0.0.1:${ollamaPort}.`;
          } finally {
            await new Promise<void>((resolve) => mockOllama.close(() => resolve()));
          }
        })
      );

      results.push(
        await runCase('ai_test_ollama_absent_or_stopped', async () => {
          const closedPort = await findAvailablePort(11540, '127.0.0.1', 30);
          process.env.OLLAMA_BASE_URL = `http://127.0.0.1:${closedPort}`;
          const conn = await OllamaProvider.testConnection();
          assert(!conn.ok && !conn.serviceRunning, 'Ollama arrêté doit retourner ok=false.');
          assert(conn.message.length > 0, 'Message d’erreur explicite attendu.');
          return `Ollama absent/arrêté détecté proprement (${conn.message}).`;
        })
      );

      results.push(
        await runCase('ai_test_gemini_not_configured', async () => {
          delete process.env.GEMINI_API_KEY;
          const status = GeminiProvider.getStatus();
          assert(!status.configured, 'Gemini ne doit pas être marqué configuré sans clé.');
          const conn = await GeminiProvider.testConnection();
          assert(
            !conn.ok && !conn.configured && conn.errorType === 'missing_key',
            'Test Gemini non configuré invalide.'
          );
          return 'État Gemini non configuré vérifié (missing_key).';
        })
      );

      results.push(
        await runCase('ai_test_gemini_configured_probe', async () => {
          process.env.GEMINI_API_KEY = 'test-key-should-never-leak';
          const status = GeminiProvider.getStatus();
          assert(status.configured, 'Gemini doit être marqué configuré.');
          const conn = await GeminiProvider.testConnection(() => ({
            models: {
              generateContent: async () => ({ text: '{"ok":true}' }),
            },
          }));
          assert(
            conn.ok && conn.configured && !conn.message.includes('test-key-should-never-leak'),
            'Probe Gemini configuré invalide ou fuite de clé.'
          );
          return `Gemini configuré vérifié (${conn.message}).`;
        })
      );

      results.push(
        await runCase('ai_test_gemini_api_errors_403_429', async () => {
          process.env.GEMINI_API_KEY = 'secret-test-key-403';
          const authErr = await GeminiProvider.testConnection(() => ({
            models: {
              generateContent: async () => {
                throw new Error('403 PERMISSION_DENIED API_KEY_INVALID');
              },
            },
          }));
          assert(
            !authErr.ok &&
              authErr.errorType === 'auth_error' &&
              !authErr.message.includes('secret-test-key-403'),
            'Erreur 403 mal mappée ou fuite de secret.'
          );

          const quotaErr = await GeminiProvider.testConnection(() => ({
            models: {
              generateContent: async () => {
                throw new Error('429 RESOURCE_EXHAUSTED');
              },
            },
          }));
          assert(
            !quotaErr.ok && quotaErr.errorType === 'quota_error',
            'Erreur 429 mal mappée.'
          );
          return 'Erreurs API Gemini 403 (auth_error) et 429 (quota_error) gérées sans exposer de clé.';
        })
      );
    } finally {
      await ctx.closeAll();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    // --- §5 : Test complet bout-en-bout sur la structure packagée resources/ + data/ (démarrage -> projet -> jeu -> preview -> arrêt -> redémarrage -> récupération) ---
    results.push(
      await runCase('e2e_packaged_layout_persistence_and_restart', async () => {
        const launcherRoot = path.join(tempRoot, 'reag-portable-sim');
        const resDir = path.join(launcherRoot, 'resources');
        fs.mkdirSync(resDir, { recursive: true });
        fs.copyFileSync(path.resolve(process.cwd(), 'package.json'), path.join(resDir, 'package.json'));
        fs.copyFileSync(path.resolve(process.cwd(), 'server.ts'), path.join(resDir, 'server.ts'));
        fs.cpSync(path.resolve(process.cwd(), 'server'), path.join(resDir, 'server'), {
          recursive: true,
        });
        fs.cpSync(path.resolve(process.cwd(), 'launcher'), path.join(resDir, 'launcher'), {
          recursive: true,
        });
        fs.symlinkSync(
          path.resolve(process.cwd(), 'node_modules'),
          path.join(resDir, 'node_modules'),
          'dir'
        );

        const realDistDir = path.resolve(process.cwd(), 'dist');
        if (fs.existsSync(realDistDir)) {
          fs.cpSync(realDistDir, path.join(resDir, 'dist'), { recursive: true });
        } else {
          fs.mkdirSync(path.join(resDir, 'dist'), { recursive: true });
          fs.writeFileSync(
            path.join(resDir, 'dist', 'index.html'),
            '<!doctype html><html><body>REAG Studio</body></html>'
          );
        }

        const launchPort = await findAvailablePort(4210, '127.0.0.1', 40);

        // Run 1 : démarrage, double instance, création projet sur disque, lancement preview, arrêt
        const run1 = await runLauncher({
          rootDir: launcherRoot,
          noBrowser: true,
          preferredPort: launchPort,
        });

        try {
          assert(!run1.alreadyRunning, 'Run 1 ne doit pas trouver d’instance existante.');

          // Vérifie que l'UI REAG Studio est servie
          const studioRes = await fetch(run1.url);
          assert(studioRes.status === 200, 'REAG Studio HTML non servi par le lanceur.');

          // Vérifie la détection de double instance
          const duplicate = await runLauncher({
            rootDir: launcherRoot,
            noBrowser: true,
            preferredPort: launchPort,
          });
          assert(
            duplicate.alreadyRunning && duplicate.url === run1.url,
            'La détection d’instance unique a échoué.'
          );

          // Sauvegarde d'un projet généré sur disque
          const savedRes = await fetch(`${run1.url}/api/projects/${sample.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...sample, name: 'Jeu E2E Persisté' }),
          });
          assert(savedRes.status === 200, 'Sauvegarde projet E2E échouée.');

          // Démarrage Preview sur port distinct
          const prevRes = await fetch(`${run1.url}/api/preview/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: sample.id, openBrowser: false }),
          });
          assert(prevRes.status === 200, 'Démarrage preview E2E échoué.');
          const prevData = (await prevRes.json()) as { preview: { url: string; port: number } };
          assert(prevData.preview.port !== run1.port, 'Le serveur de jeu doit utiliser un port distinct.');

          const gameHtmlRes = await fetch(prevData.preview.url);
          assert(gameHtmlRes.status === 200, 'Jeu 2D inaccessible sur le serveur preview.');

          // Arrêt du jeu puis arrêt propre via /api/launcher/shutdown
          await fetch(`${run1.url}/api/preview/stop`, { method: 'POST' });
          await fetch(`${run1.url}/api/launcher/shutdown`, { method: 'POST' });

          // Attendre la fermeture effective du processus
          const deadline = Date.now() + 4000;
          while (Date.now() < deadline) {
            try {
              await fetch(`${run1.url}/api/health`);
              await new Promise((r) => setTimeout(r, 100));
            } catch {
              break;
            }
          }
        } finally {
          await run1.stop?.();
        }

        // Run 2 : redémarrage et récupération du projet depuis data/projects/
        const run2 = await runLauncher({
          rootDir: launcherRoot,
          noBrowser: true,
          preferredPort: launchPort,
        });
        try {
          const reloadRes = await fetch(`${run2.url}/api/projects`);
          const reloadData = (await reloadRes.json()) as {
            projects: Array<{ id: string; name: string }>;
          };
          const recovered = reloadData.projects.find((p) => p.id === sample.id);
          assert(
            Boolean(recovered && recovered.name === 'Jeu E2E Persisté'),
            'Le projet sauvegardé n’a pas été récupéré après redémarrage.'
          );
        } finally {
          await run2.stop?.();
        }

        const lockExists = fs.existsSync(path.join(launcherRoot, 'data', 'reag.lock.json'));
        assert(!lockExists, 'reag.lock.json doit être supprimé après arrêt.');
        return `Parcours E2E complet validé sur ${run1.url} (double instance, projet disque, preview distinct, arrêt, redémarrage et récupération).`;
      })
    );
  } finally {
    if (prevLocalMode === undefined) delete process.env.REAG_LOCAL_MODE;
    else process.env.REAG_LOCAL_MODE = prevLocalMode;

    if (prevOllamaUrl === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = prevOllamaUrl;

    if (prevGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevGeminiKey;

    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log('\n=== REAG V2 — Suite de tests d’intégration (Sécurité / Preview / IA Hybride / Launcher E2E) ===');
  for (const r of results) {
    const icon = r.passed ? '[OK]' : '[ECHEC]';
    console.log(`${icon} ${r.name} — ${r.passed ? r.details : r.error}`);
  }
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`Résumé intégration : ${passedCount}/${results.length} réussis.`);
  if (passedCount !== results.length) {
    process.exitCode = 1;
  }
}

void main();

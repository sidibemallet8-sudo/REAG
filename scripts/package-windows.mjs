import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const outDir = path.join(rootDir, 'dist-portable', 'REAG-Windows');
const resourcesDir = path.join(outDir, 'resources');
const runtimeDir = path.join(outDir, 'runtime');
const dataDir = path.join(outDir, 'data');

const PRODUCTION_ROOT_DEPS = ['express', 'dotenv', '@google/genai'];

function ensureBuildExists() {
  const distIndex = path.join(rootDir, 'dist', 'index.html');
  if (!fs.existsSync(distIndex)) {
    throw new Error('dist/index.html introuvable. Exécutez d’abord "npm run build".');
  }
}

function collectRuntimeDependencies(nodeModulesRoot) {
  const seen = new Set();
  const queue = [...PRODUCTION_ROOT_DEPS];

  while (queue.length > 0) {
    const pkgName = queue.shift();
    if (!pkgName || seen.has(pkgName)) continue;
    const pkgDir = path.join(nodeModulesRoot, pkgName);
    const pkgJsonPath = path.join(pkgDir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) continue;

    seen.add(pkgName);
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      const deps = pkg.dependencies || {};
      for (const dep of Object.keys(deps)) {
        if (!seen.has(dep)) queue.push(dep);
      }
    } catch {
      // Ignore malformed package metadata
    }
  }

  return Array.from(seen).sort();
}

function copyRuntimeNodeModules(targetNodeModules) {
  const srcNodeModules = path.join(rootDir, 'node_modules');
  const packages = collectRuntimeDependencies(srcNodeModules);
  fs.mkdirSync(targetNodeModules, { recursive: true });

  for (const pkgName of packages) {
    const srcPkg = path.join(srcNodeModules, pkgName);
    const dstPkg = path.join(targetNodeModules, pkgName);
    fs.mkdirSync(path.dirname(dstPkg), { recursive: true });
    fs.cpSync(srcPkg, dstPkg, { recursive: true, dereference: true });
  }
  return packages.length;
}

function buildRuntimePackageJson() {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  const runtimeDeps = {};
  for (const dep of PRODUCTION_ROOT_DEPS) {
    if (rootPkg.dependencies?.[dep]) {
      runtimeDeps[dep] = rootPkg.dependencies[dep];
    }
  }
  return JSON.stringify(
    {
      name: 'reag-studio-runtime',
      version: rootPkg.version || '2.0.0',
      private: true,
      type: 'module',
      scripts: {
        start: 'node launcher/reag-launcher.ts',
      },
      dependencies: runtimeDeps,
    },
    null,
    2
  );
}

function buildCSharpLauncherSource() {
  // C# 5 compatible strictly with Windows 10 built-in .NET Framework 4.x csc.exe
  return `using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

namespace ReagLauncherApp {
    static class Program {
        private static Process serverProc = null;
        private static string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        private static string dataDir = Path.Combine(baseDir, "data");
        private static string lockPath = Path.Combine(dataDir, "reag.lock.json");
        private static string logPath = Path.Combine(dataDir, "launcher.log");
        private static string activeUrl = null;
        private static NotifyIcon trayIcon = null;

        [STAThread]
        static int Main(string[] args) {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string existingUrl = TryGetHealthyLockUrl();
            if (!string.IsNullOrEmpty(existingUrl)) {
                OpenBrowser(existingUrl);
                return 0;
            }

            string resourcesDir = Path.Combine(baseDir, "resources");
            string portableNode = Path.Combine(baseDir, "runtime", "node.exe");
            string nodeExe = File.Exists(portableNode) ? portableNode : "node";
            string entryScript = Path.Combine(resourcesDir, "launcher", "reag-launcher.ts");
            string distIndex = Path.Combine(resourcesDir, "dist", "index.html");

            if (!File.Exists(entryScript) || !File.Exists(distIndex)) {
                MessageBox.Show(
                    "Fichiers REAG introuvables dans le dossier resources/. Vérifiez l'extraction complète de REAG-Windows.zip.",
                    "REAG Studio — Ressources manquantes",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return 1;
            }

            if (!File.Exists(portableNode)) {
                try {
                    var testProc = new ProcessStartInfo();
                    testProc.FileName = "node";
                    testProc.Arguments = "--version";
                    testProc.CreateNoWindow = true;
                    testProc.UseShellExecute = false;
                    var p = Process.Start(testProc);
                    if (p == null) throw new Exception("Node introuvable");
                    p.WaitForExit(2000);
                    if (p.ExitCode != 0) throw new Exception("Node invalide");
                } catch {
                    MessageBox.Show(
                        "Le moteur Node.js portable (runtime\\\\node.exe) est absent et Node.js n'est pas installé sur ce PC.\\n\\nExécutez prepare-windows-zip.ps1 ou placez node.exe (v22 LTS x64) dans runtime\\\\node.exe.",
                        "REAG Studio — Runtime manquant",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                    return 1;
                }
            }

            Directory.CreateDirectory(dataDir);

            var psi = new ProcessStartInfo();
            psi.FileName = nodeExe;
            psi.Arguments = "\\"" + entryScript + "\\"";
            psi.WorkingDirectory = baseDir;
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.EnvironmentVariables["REAG_LOCAL_MODE"] = "true";
            psi.EnvironmentVariables["REAG_SERVE_STATIC"] = "true";
            psi.EnvironmentVariables["REAG_DATA_DIR"] = dataDir;
            psi.EnvironmentVariables["REAG_RESOURCES_DIR"] = resourcesDir;

            try {
                serverProc = Process.Start(psi);
                if (serverProc == null) {
                    throw new Exception("Impossible de créer le processus REAG.");
                }
            } catch (Exception ex) {
                MessageBox.Show(
                    "Échec du démarrage de REAG : " + ex.Message,
                    "REAG Studio — Erreur de lancement",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return 1;
            }

            DateTime deadline = DateTime.UtcNow.AddSeconds(18);
            while (DateTime.UtcNow < deadline) {
                if (serverProc.HasExited) {
                    string logTail = ReadLogTail(logPath);
                    MessageBox.Show(
                        "Le serveur local REAG s'est arrêté prématurément (code " + serverProc.ExitCode + ").\\n\\nJournal : " + logPath + "\\n\\n" + logTail,
                        "REAG Studio — Erreur serveur",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                    return 1;
                }
                activeUrl = TryGetHealthyLockUrl();
                if (!string.IsNullOrEmpty(activeUrl)) {
                    break;
                }
                Thread.Sleep(150);
            }

            if (string.IsNullOrEmpty(activeUrl)) {
                ShutdownServices();
                MessageBox.Show(
                    "REAG Local Host n'a pas répondu dans le délai imparti. Consultez : " + logPath,
                    "REAG Studio — Délai dépassé",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return 1;
            }

            SetupTrayAndRun();
            return 0;
        }

        private static void SetupTrayAndRun() {
            var menu = new ContextMenuStrip();
            menu.Items.Add("Ouvrir REAG Studio dans Chrome", null, delegate {
                string u = TryGetHealthyLockUrl();
                if (!string.IsNullOrEmpty(u)) OpenBrowser(u);
            });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Arrêter et quitter REAG", null, delegate {
                ShutdownServices();
                if (trayIcon != null) trayIcon.Visible = false;
                Application.Exit();
            });

            trayIcon = new NotifyIcon();
            trayIcon.Icon = SystemIcons.Application;
            trayIcon.Text = "REAG Studio (" + activeUrl + ")";
            trayIcon.ContextMenuStrip = menu;
            trayIcon.Visible = true;
            trayIcon.DoubleClick += delegate {
                string u = TryGetHealthyLockUrl();
                if (!string.IsNullOrEmpty(u)) OpenBrowser(u);
            };
            trayIcon.ShowBalloonTip(2500, "REAG Studio actif", "Interface disponible sur " + activeUrl, ToolTipIcon.Info);

            var watcher = new System.Windows.Forms.Timer();
            watcher.Interval = 1500;
            watcher.Tick += delegate {
                if (serverProc != null && serverProc.HasExited) {
                    watcher.Stop();
                    if (trayIcon != null) trayIcon.Visible = false;
                    Application.Exit();
                }
            };
            watcher.Start();

            Application.ApplicationExit += delegate {
                ShutdownServices();
            };

            Application.Run();
        }

        private static string TryGetHealthyLockUrl() {
            try {
                if (!File.Exists(lockPath)) return null;
                string raw = File.ReadAllText(lockPath, Encoding.UTF8);
                Match m = Regex.Match(raw, "\\"url\\"\\s*:\\s*\\"(http://127\\.0\\.0\\.1:\\d+)\\"");
                if (!m.Success) return null;
                string url = m.Groups[1].Value;

                using (var wc = new WebClient()) {
                    wc.Encoding = Encoding.UTF8;
                    string body = wc.DownloadString(url + "/api/health");
                    if (body.Contains("\\"REAG Local Host\\"")) {
                        return url;
                    }
                }
            } catch {
                // Pas encore prêt ou verrou obsolète
            }
            return null;
        }

        private static void OpenBrowser(string url) {
            try {
                string[] chromePaths = new string[] {
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google\\\\Chrome\\\\Application\\\\chrome.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google\\\\Chrome\\\\Application\\\\chrome.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google\\\\Chrome\\\\Application\\\\chrome.exe")
                };
                for (int i = 0; i < chromePaths.Length; i++) {
                    if (File.Exists(chromePaths[i])) {
                        Process.Start(chromePaths[i], url);
                        return;
                    }
                }
                Process.Start(url);
            } catch {
                // Ignorer si Chrome ou shell indisponible
            }
        }

        private static void ShutdownServices() {
            try {
                if (!string.IsNullOrEmpty(activeUrl)) {
                    using (var wc = new WebClient()) {
                        wc.UploadString(activeUrl + "/api/launcher/shutdown", "POST", "{}");
                    }
                }
            } catch {
                // Continuer avec arrêt processus si HTTP déjà fermé
            }

            try {
                if (serverProc != null && !serverProc.HasExited) {
                    if (!serverProc.WaitForExit(1800)) {
                        serverProc.Kill();
                    }
                }
            } catch {
                // Ignore
            }

            try {
                if (File.Exists(lockPath)) {
                    File.Delete(lockPath);
                }
            } catch {
                // Ignore
            }
        }

        private static string ReadLogTail(string path) {
            try {
                if (!File.Exists(path)) return "";
                string[] lines = File.ReadAllLines(path, Encoding.UTF8);
                int start = Math.Max(0, lines.Length - 8);
                return string.Join("\\n", lines, start, lines.Length - start);
            } catch {
                return "";
            }
        }
    }
}
`;
}

function main() {
  ensureBuildExists();
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(resourcesDir, { recursive: true });
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'projects'), { recursive: true });

  // 1. Copier les ressources applicatives dans resources/
  const resourceItems = ['dist', 'server', 'launcher', 'server.ts'];
  for (const item of resourceItems) {
    const src = path.join(rootDir, item);
    const dst = path.join(resourcesDir, item);
    if (fs.existsSync(src)) {
      fs.cpSync(src, dst, { recursive: true });
    }
  }

  fs.writeFileSync(path.join(resourcesDir, 'package.json'), buildRuntimePackageJson(), 'utf-8');
  const pkgCount = copyRuntimeNodeModules(path.join(resourcesDir, 'node_modules'));

  // 2. Documentation utilisateur et scripts Windows à la racine de REAG-Windows/
  for (const doc of ['LAUNCHER_WINDOWS.md', 'README.md', 'ARCHITECTURE.md']) {
    const src = path.join(rootDir, doc);
    if (fs.existsSync(src)) {
      fs.cpSync(src, path.join(outDir, doc));
    }
  }

  const readmeTxt = `REAG Studio V2 — Distribution portable Windows 10
===================================================

LANCEMENT RAPIDE
----------------
1. Extrayez l'archive complète dans un dossier local (ex. C:\\REAG-Windows\\).
2. Double-cliquez sur REAG.exe (aucune installation préalable requise si runtime\\node.exe est présent).
3. REAG démarre les services locaux sur 127.0.0.1 (ports automatiques, ex. 4173 et 4174) et ouvre Google Chrome.
4. Une icône REAG apparaît dans la zone de notification Windows (système tray) pour rouvrir Chrome ou arrêter proprement le serveur.

REPERTOIRES
-----------
- runtime\\node.exe : moteur Node.js v22 portable embarqué.
- resources\\       : interface REAG Studio compilée, serveur REAG Local Host et dépendances runtime.
- data\\            : vos projets sauvegardés sur disque, journaux (launcher.log) et verrou d'instance unique.

SECURITE & CONFIDENTIALITE
--------------------------
- Les serveurs locaux écoutent uniquement sur 127.0.0.1.
- Le mode sans IA fonctionne 100 % hors ligne.
- Ollama local et Gemini côté serveur restent strictement optionnels.
`;
  fs.writeFileSync(path.join(outDir, 'README.txt'), readmeTxt, 'utf-8');

  const runtimeNote = `Placez ici le binaire officiel Windows x64 "node.exe" (Node.js v22 LTS) :
https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip
Ou exécutez le script PowerShell "prepare-windows-zip.ps1" sous Windows 10.
`;
  fs.writeFileSync(path.join(runtimeDir, 'README-RUNTIME.txt'), runtimeNote, 'utf-8');

  const winCmd = `@echo off
setlocal
cd /d "%~dp0"
set REAG_LOCAL_MODE=true
set REAG_SERVE_STATIC=true
set REAG_DATA_DIR=%~dp0data
set REAG_RESOURCES_DIR=%~dp0resources
if exist "%~dp0runtime\\node.exe" (
  "%~dp0runtime\\node.exe" "%~dp0resources\\launcher\\reag-launcher.ts"
) else (
  node "%~dp0resources\\launcher\\reag-launcher.ts"
)
if errorlevel 1 pause
`;
  fs.writeFileSync(path.join(outDir, 'REAG-Start.cmd'), winCmd, 'utf-8');

  fs.writeFileSync(path.join(outDir, 'REAGLauncher.cs'), buildCSharpLauncherSource(), 'utf-8');

  const buildExePs1 = `$ErrorActionPreference = "Stop"
$csc = "$env:WINDIR\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe"
if (-not (Test-Path $csc)) {
  $csc = "$env:WINDIR\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe"
}
if (-not (Test-Path $csc)) {
  Write-Error "Compilateur C# .NET Framework introuvable."
}
& $csc /nologo /target:winexe /optimize+ /r:System.Windows.Forms.dll /r:System.Drawing.dll /out:"$PSScriptRoot\\REAG.exe" "$PSScriptRoot\\REAGLauncher.cs"
Write-Host "REAG.exe compilé sans fenêtre terminal dans $PSScriptRoot\\REAG.exe"
`;
  fs.writeFileSync(path.join(outDir, 'build-reag-exe.ps1'), buildExePs1, 'utf-8');

  const prepareZipPs1 = `$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$nodeVersion = "v22.14.0"
$nodeZipUrl = "https://nodejs.org/dist/$nodeVersion/node-$nodeVersion-win-x64.zip"
$runtimeNode = Join-Path $root "runtime\\node.exe"

if (-not (Test-Path $runtimeNode)) {
  Write-Host "Téléchargement de Node.js $nodeVersion Windows x64..."
  $tmpZip = Join-Path $env:TEMP "node-$nodeVersion-win-x64.zip"
  $tmpExtract = Join-Path $env:TEMP "node-$nodeVersion-extract"
  Invoke-WebRequest -Uri $nodeZipUrl -OutFile $tmpZip
  if (Test-Path $tmpExtract) { Remove-Item $tmpExtract -Recurse -Force }
  Expand-Archive -Path $tmpZip -DestinationPath $tmpExtract -Force
  Copy-Item (Join-Path $tmpExtract "node-$nodeVersion-win-x64\\node.exe") $runtimeNode -Force
  Remove-Item $tmpZip -Force
  Remove-Item $tmpExtract -Recurse -Force
}

Write-Host "Compilation de REAG.exe (/target:winexe)..."
& (Join-Path $root "build-reag-exe.ps1")

Write-Host "Vérification rapide du runtime portable..."
& $runtimeNode --version

$zipOut = Join-Path (Split-Path $root -Parent) "REAG-Windows.zip"
if (Test-Path $zipOut) { Remove-Item $zipOut -Force }
Compress-Archive -Path $root -DestinationPath $zipOut
Write-Host "Archive finale prête : $zipOut"
`;
  fs.writeFileSync(path.join(outDir, 'prepare-windows-zip.ps1'), prepareZipPs1, 'utf-8');

  console.log(`[REAG Package] Dossier portable structuré dans : ${outDir}`);
  console.log(`[REAG Package] ${pkgCount} paquet(s) runtime copiés dans resources/node_modules (0 devDependency).`);
  console.log(
    '[REAG Package] Note : Sous Linux, REAG.exe et runtime/node.exe ne sont pas compilés/téléchargés ici. Exécutez prepare-windows-zip.ps1 sous Windows 10 pour produire REAG.exe + runtime/node.exe + REAG-Windows.zip.'
  );
}

main();

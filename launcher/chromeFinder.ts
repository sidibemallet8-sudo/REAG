import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface ChromeDetectionResult {
  found: boolean;
  executablePath: string | null;
  platform: string;
}

export function findChromeExecutable(): ChromeDetectionResult {
  const platform = process.platform;
  const candidates: string[] = [];

  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    candidates.push(
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    );
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return { found: true, executablePath: candidate, platform };
    }
  }

  return { found: false, executablePath: null, platform };
}

export function openUrlInBrowser(url: string): { launched: boolean; method: string; message: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { launched: false, method: 'none', message: 'URL invalide.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { launched: false, method: 'none', message: 'Protocole URL non autorisé.' };
  }
  if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
    return {
      launched: false,
      method: 'none',
      message: 'Ouverture bloquée : seules les URL locales (127.0.0.1 / localhost) sont autorisées.',
    };
  }

  const chrome = findChromeExecutable();
  try {
    if (chrome.found && chrome.executablePath) {
      const child = spawn(chrome.executablePath, [url], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return {
        launched: true,
        method: 'chrome',
        message: `Navigateur lancé (${chrome.executablePath}).`,
      };
    }

    if (process.platform === 'win32') {
      const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return {
        launched: true,
        method: 'windows_shell',
        message: 'Ouverture via le navigateur par défaut Windows.',
      };
    }

    return {
      launched: false,
      method: 'manual',
      message: `Aucun binaire Google Chrome détecté automatiquement sur ${process.platform}. Ouvrez manuellement : ${url}`,
    };
  } catch (err) {
    return {
      launched: false,
      method: 'error',
      message: err instanceof Error ? err.message : 'Erreur lors du lancement du navigateur.',
    };
  }
}

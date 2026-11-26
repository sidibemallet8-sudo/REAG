import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';

const PROJECT_ID_RE = /^[a-zA-Z0-9_-]{3,80}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function isLocalHostname(hostname: string): boolean {
  const clean = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return clean === '127.0.0.1' || clean === 'localhost' || clean === '::1';
}

export function getBindHost(): string {
  if (process.env.REAG_LOCAL_MODE === 'true') {
    return '127.0.0.1';
  }
  const configured = process.env.REAG_HOST?.trim();
  if (configured && process.env.REAG_ALLOW_REMOTE === 'true') {
    return configured;
  }
  if (configured === '0.0.0.0' && process.env.PORT === '3000') {
    return '0.0.0.0';
  }
  return '127.0.0.1';
}

export function sanitizeProjectId(id: unknown): string {
  if (typeof id !== 'string' || !PROJECT_ID_RE.test(id)) {
    throw new Error('Identifiant de projet invalide.');
  }
  return id;
}

export function resolveSafePath(baseDir: string, ...segments: string[]): string {
  const resolvedBase = path.resolve(baseDir);
  for (const seg of segments) {
    if (!seg || seg.includes('\0') || seg.includes('..')) {
      throw new Error('Chemin refusé : séquence non autorisée.');
    }
  }
  const target = path.resolve(resolvedBase, ...segments);
  if (target !== resolvedBase && !target.startsWith(resolvedBase + path.sep)) {
    throw new Error('Accès refusé : traversée de répertoire bloquée.');
  }
  return target;
}

export function assertNoForbiddenKeys(value: unknown, depth = 0): void {
  if (depth > 12 || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) assertNoForbiddenKeys(item, depth + 1);
    return;
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`Clé interdite détectée dans le payload (${key}).`);
    }
    assertNoForbiddenKeys((value as Record<string, unknown>)[key], depth + 1);
  }
}

export function localAccessGuard(req: Request, res: Response, next: NextFunction): void {
  if (process.env.REAG_LOCAL_MODE === 'true') {
    // Protection contre le DNS rebinding sur l'en-tête Host
    const hostHeader = req.headers.host;
    if (hostHeader) {
      try {
        const parsedHost = new URL(`http://${hostHeader}`);
        if (!isLocalHostname(parsedHost.hostname)) {
          res.status(403).json({
            error: 'Accès refusé : hôte non local bloqué par REAG Local Host.',
          });
          return;
        }
      } catch {
        res.status(403).json({ error: 'En-tête Host invalide.' });
        return;
      }
    }

    // Refuser les origines externes non localhost si Origin est fourni
    const origin = req.headers.origin;
    if (origin) {
      try {
        const parsedOrigin = new URL(origin);
        if (!isLocalHostname(parsedOrigin.hostname)) {
          res.status(403).json({
            error: 'Accès refusé : origine externe bloquée par REAG Local Host.',
          });
          return;
        }
      } catch {
        res.status(403).json({ error: 'En-tête Origin invalide.' });
        return;
      }
    }
  }
  next();
}

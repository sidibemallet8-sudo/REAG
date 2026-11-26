import { createBlankProject, createSampleProject } from '../data/sampleProject';
import {
  DocumentarySource,
  GameObservation,
  ObservationCategory,
  ObservationConfidence,
  ReagProject,
  ReagSettings,
  SourceKind,
  SourceReliability,
} from '../types/reag';
import { SpecificationEngine } from './specificationEngine';

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const memoryStorageMap = new Map<string, string>();

export const memoryStorage: StorageBackend = {
  getItem: (key) => memoryStorageMap.get(key) ?? null,
  setItem: (key, value) => {
    memoryStorageMap.set(key, value);
  },
  removeItem: (key) => {
    memoryStorageMap.delete(key);
  },
};

export function getDefaultStorage(): StorageBackend {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Fallback si localStorage est restreint
  }
  return memoryStorage;
}

export const DEFAULT_SETTINGS: ReagSettings = {
  autoAnalyzeOnImport: true,
  soundEnabled: true,
  showRuntimeDebugVectors: false,
  storageNamespace: 'reag_v1_workspace',
};

const VALID_SOURCE_KINDS: SourceKind[] = [
  'manuel',
  'note_gameplay',
  'article_technique',
  'capture_regles',
  'fichier_importe',
];
const VALID_SOURCE_RELIABILITIES: SourceReliability[] = ['verifiee', 'partielle', 'hypothese'];
const VALID_OBS_CATEGORIES: ObservationCategory[] = [
  'deplacement',
  'collecte',
  'obstacle',
  'danger',
  'score',
  'victoire',
  'defaite',
  'controle',
  'physique',
];
const VALID_OBS_CONFIDENCES: ObservationConfidence[] = ['confirmee', 'deduite', 'incertaine'];
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function sanitizeParameters(
  rawParams: unknown,
  contextLabel: string
): Record<string, string | number | boolean> {
  if (rawParams === undefined || rawParams === null) return {};
  if (!isPlainRecord(rawParams)) {
    throw new Error(`${contextLabel} : le champ "parameters" doit être un objet.`);
  }
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(rawParams)) {
    if (FORBIDDEN_KEYS.has(k)) {
      throw new Error(`${contextLabel} : clé interdite détectée ("${k}").`);
    }
    if (typeof v === 'string' || typeof v === 'boolean') {
      clean[k] = v;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      clean[k] = v;
    } else {
      throw new Error(
        `${contextLabel} : paramètre "${k}" invalide (type non primitif ou nombre non fini).`
      );
    }
  }
  return clean;
}

function validateAndNormalizeSource(raw: unknown, index: number): DocumentarySource {
  if (!isPlainRecord(raw)) {
    throw new Error(`Source #${index + 1} invalide : objet attendu.`);
  }
  if (typeof raw.title !== 'string' || !raw.title.trim()) {
    throw new Error(`Source #${index + 1} invalide : titre manquant ou vide.`);
  }
  if (typeof raw.excerpt !== 'string' || !raw.excerpt.trim()) {
    throw new Error(`Source #${index + 1} invalide : extrait documentaire manquant ou vide.`);
  }
  const kind = VALID_SOURCE_KINDS.includes(raw.kind as SourceKind)
    ? (raw.kind as SourceKind)
    : 'fichier_importe';
  const reliability = VALID_SOURCE_RELIABILITIES.includes(raw.reliability as SourceReliability)
    ? (raw.reliability as SourceReliability)
    : 'partielle';

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `src_imp_${index + 1}`,
    title: raw.title.trim(),
    kind,
    reliability,
    reference:
      typeof raw.reference === 'string' && raw.reference.trim()
        ? raw.reference.trim()
        : 'import-json',
    excerpt: raw.excerpt.trim(),
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt.trim()
        ? raw.createdAt
        : new Date().toISOString(),
  };
}

function validateAndNormalizeObservation(raw: unknown, index: number): GameObservation {
  if (!isPlainRecord(raw)) {
    throw new Error(`Observation #${index + 1} invalide : objet attendu.`);
  }
  if (typeof raw.title !== 'string' || !raw.title.trim()) {
    throw new Error(`Observation #${index + 1} invalide : titre manquant ou vide.`);
  }
  if (typeof raw.description !== 'string' || !raw.description.trim()) {
    throw new Error(`Observation #${index + 1} invalide : description manquante ou vide.`);
  }
  if (!VALID_OBS_CATEGORIES.includes(raw.category as ObservationCategory)) {
    throw new Error(
      `Observation #${index + 1} ("${raw.title}") invalide : catégorie "${String(
        raw.category
      )}" inconnue.`
    );
  }
  const confidence = VALID_OBS_CONFIDENCES.includes(raw.confidence as ObservationConfidence)
    ? (raw.confidence as ObservationConfidence)
    : 'deduite';

  if (raw.sourceId !== undefined && raw.sourceId !== null && typeof raw.sourceId !== 'string') {
    throw new Error(`Observation #${index + 1} invalide : "sourceId" doit être une chaîne.`);
  }

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `obs_imp_${index + 1}`,
    category: raw.category as ObservationCategory,
    title: raw.title.trim(),
    description: raw.description.trim(),
    sourceId: typeof raw.sourceId === 'string' && raw.sourceId.trim() ? raw.sourceId.trim() : undefined,
    confidence,
    parameters: sanitizeParameters(raw.parameters, `Observation #${index + 1}`),
    importedFrom: typeof raw.importedFrom === 'string' ? raw.importedFrom : undefined,
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt.trim()
        ? raw.createdAt
        : new Date().toISOString(),
  };
}

export function validateImportedProjectPayload(rawJson: string): ReagProject {
  if (typeof rawJson !== 'string' || !rawJson.trim()) {
    throw new Error('Import refusé : contenu JSON vide.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Fichier JSON invalide : syntaxe impossible à analyser.');
  }

  if (!isPlainRecord(parsed)) {
    throw new Error('Import refusé : le document JSON racine doit être un objet.');
  }

  for (const key of Object.keys(parsed)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`Import refusé : clé dangereuse détectée ("${key}").`);
    }
  }

  const candidate = 'project' in parsed ? parsed.project : parsed;
  if (!isPlainRecord(candidate)) {
    throw new Error('Structure de projet REAG invalide : objet "project" attendu.');
  }
  for (const key of Object.keys(candidate)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`Import refusé : clé dangereuse détectée ("${key}").`);
    }
  }

  if (typeof candidate.name !== 'string' || !candidate.name.trim()) {
    throw new Error('Projet invalide : le champ "name" doit être une chaîne non vide.');
  }
  if (
    candidate.referenceSubject !== undefined &&
    typeof candidate.referenceSubject !== 'string'
  ) {
    throw new Error('Projet invalide : "referenceSubject" doit être une chaîne.');
  }
  if (candidate.description !== undefined && typeof candidate.description !== 'string') {
    throw new Error('Projet invalide : "description" doit être une chaîne.');
  }
  if (!Array.isArray(candidate.sources)) {
    throw new Error('Projet invalide : le tableau "sources" est manquant ou corrompu.');
  }
  if (!Array.isArray(candidate.observations)) {
    throw new Error('Projet invalide : le tableau "observations" est manquant ou corrompu.');
  }

  const sources = candidate.sources.map((s, idx) => validateAndNormalizeSource(s, idx));
  const observations = candidate.observations.map((o, idx) =>
    validateAndNormalizeObservation(o, idx)
  );

  let validatedSpec = null;
  if (candidate.specification !== undefined && candidate.specification !== null) {
    if (!isPlainRecord(candidate.specification)) {
      throw new Error('Projet invalide : le bloc "specification" est corrompu.');
    }
    const specRes = SpecificationEngine.validateSpecification(
      candidate.specification as unknown as NonNullable<ReagProject['specification']>
    );
    if (!specRes.valid) {
      throw new Error(
        `Spécification du projet importé invalide : ${specRes.errors.join(' ')}`
      );
    }
    validatedSpec = candidate.specification as unknown as NonNullable<ReagProject['specification']>;
  }

  const now = new Date().toISOString();
  return {
    id: `proj_imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: `${candidate.name.trim()} (Importé)`,
    referenceSubject:
      typeof candidate.referenceSubject === 'string' ? candidate.referenceSubject.trim() : '',
    description: typeof candidate.description === 'string' ? candidate.description.trim() : '',
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : now,
    updatedAt: now,
    sources,
    observations,
    // L'analyse et l'artefact généré doivent être recalculés proprement après validation
    analysis: null,
    specification: validatedSpec,
    generatedArtifact: null,
  };
}

export class ProjectManager {
  private storage: StorageBackend;
  private projectsKey: string;
  private activeIdKey: string;
  private settingsKey: string;

  constructor(storage: StorageBackend = getDefaultStorage(), namespace = 'reag_v1_workspace') {
    this.storage = storage;
    this.projectsKey = `${namespace}_projects`;
    this.activeIdKey = `${namespace}_active_id`;
    this.settingsKey = `${namespace}_settings`;
  }

  loadSettings(): ReagSettings {
    const raw = this.storage.getItem(this.settingsKey);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      const parsed = JSON.parse(raw) as Partial<ReagSettings>;
      if (!isPlainRecord(parsed)) return { ...DEFAULT_SETTINGS };
      return {
        ...DEFAULT_SETTINGS,
        autoAnalyzeOnImport:
          typeof parsed.autoAnalyzeOnImport === 'boolean'
            ? parsed.autoAnalyzeOnImport
            : DEFAULT_SETTINGS.autoAnalyzeOnImport,
        soundEnabled:
          typeof parsed.soundEnabled === 'boolean'
            ? parsed.soundEnabled
            : DEFAULT_SETTINGS.soundEnabled,
        showRuntimeDebugVectors:
          typeof parsed.showRuntimeDebugVectors === 'boolean'
            ? parsed.showRuntimeDebugVectors
            : DEFAULT_SETTINGS.showRuntimeDebugVectors,
        storageNamespace:
          typeof parsed.storageNamespace === 'string' && parsed.storageNamespace.trim()
            ? parsed.storageNamespace
            : DEFAULT_SETTINGS.storageNamespace,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings: ReagSettings): void {
    this.storage.setItem(this.settingsKey, JSON.stringify(settings));
  }

  loadProjects(): ReagProject[] {
    const raw = this.storage.getItem(this.projectsKey);
    if (!raw) {
      const sample = createSampleProject();
      this.saveProjects([sample]);
      this.setActiveProjectId(sample.id);
      return [sample];
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const sample = createSampleProject();
        this.saveProjects([sample]);
        return [sample];
      }
      const validProjects = parsed.filter(
        (p): p is ReagProject =>
          isPlainRecord(p) &&
          typeof p.id === 'string' &&
          typeof p.name === 'string' &&
          Array.isArray(p.sources) &&
          Array.isArray(p.observations)
      );
      if (validProjects.length === 0) {
        const sample = createSampleProject();
        this.saveProjects([sample]);
        return [sample];
      }
      return validProjects;
    } catch {
      const sample = createSampleProject();
      this.saveProjects([sample]);
      return [sample];
    }
  }

  saveProjects(projects: ReagProject[]): void {
    this.storage.setItem(this.projectsKey, JSON.stringify(projects));
  }

  getActiveProjectId(projects: ReagProject[]): string {
    const saved = this.storage.getItem(this.activeIdKey);
    if (saved && projects.some((p) => p.id === saved)) {
      return saved;
    }
    const fallback = projects[0]?.id ?? '';
    if (fallback) {
      this.setActiveProjectId(fallback);
    }
    return fallback;
  }

  setActiveProjectId(id: string): void {
    this.storage.setItem(this.activeIdKey, id);
  }

  createProject(name: string, referenceSubject: string, description: string): ReagProject {
    if (!name.trim()) {
      throw new Error('Le nom du projet est obligatoire.');
    }
    const project = createBlankProject(name, referenceSubject, description);
    const all = this.loadProjects();
    const updated = [project, ...all];
    this.saveProjects(updated);
    this.setActiveProjectId(project.id);
    return project;
  }

  updateProject(updatedProject: ReagProject): ReagProject[] {
    const all = this.loadProjects();
    const stamped: ReagProject = {
      ...updatedProject,
      updatedAt: new Date().toISOString(),
    };
    const next = all.map((p) => (p.id === stamped.id ? stamped : p));
    this.saveProjects(next);
    return next;
  }

  deleteProject(projectId: string): ReagProject[] {
    const all = this.loadProjects().filter((p) => p.id !== projectId);
    if (all.length === 0) {
      const sample = createSampleProject();
      this.saveProjects([sample]);
      this.setActiveProjectId(sample.id);
      return [sample];
    }
    this.saveProjects(all);
    this.setActiveProjectId(all[0].id);
    return all;
  }

  duplicateProject(projectId: string): ReagProject | null {
    const all = this.loadProjects();
    const source = all.find((p) => p.id === projectId);
    if (!source) return null;
    const now = new Date().toISOString();
    const clone: ReagProject = {
      ...JSON.parse(JSON.stringify(source)),
      id: `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${source.name} (Copie)`,
      createdAt: now,
      updatedAt: now,
    };
    this.saveProjects([clone, ...all]);
    this.setActiveProjectId(clone.id);
    return clone;
  }

  exportProjectJson(project: ReagProject): string {
    return JSON.stringify(
      {
        reagExportVersion: '1.0',
        exportedAt: new Date().toISOString(),
        project,
      },
      null,
      2
    );
  }

  importProjectJson(rawJson: string): ReagProject {
    // Valide intégralement avant de lire ou modifier le stockage existant
    const imported = validateImportedProjectPayload(rawJson);
    const existing = this.loadProjects();
    this.saveProjects([imported, ...existing]);
    this.setActiveProjectId(imported.id);
    return imported;
  }

  resetWorkspaceToSample(): ReagProject[] {
    const sample = createSampleProject();
    this.saveProjects([sample]);
    this.setActiveProjectId(sample.id);
    return [sample];
  }
}

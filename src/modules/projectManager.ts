import { createBlankProject, createSampleProject } from '../data/sampleProject';
import { ReagProject, ReagSettings } from '../types/reag';

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
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
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
      return parsed as ReagProject[];
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new Error('Fichier JSON invalide : syntaxe impossible à analyser.');
    }

    const candidate =
      typeof parsed === 'object' && parsed !== null && 'project' in parsed
        ? (parsed as { project: unknown }).project
        : parsed;

    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      typeof (candidate as ReagProject).name !== 'string' ||
      !Array.isArray((candidate as ReagProject).sources) ||
      !Array.isArray((candidate as ReagProject).observations)
    ) {
      throw new Error(
        'Structure de projet REAG invalide : champs requis (name, sources, observations) manquants.'
      );
    }

    const rawProj = candidate as ReagProject;
    const now = new Date().toISOString();
    const imported: ReagProject = {
      ...rawProj,
      id: `proj_imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${rawProj.name.trim()} (Importé)`,
      createdAt: rawProj.createdAt || now,
      updatedAt: now,
    };

    const all = this.loadProjects();
    this.saveProjects([imported, ...all]);
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

import fs from 'node:fs';
import path from 'node:path';
import {
  assertNoForbiddenKeys,
  resolveSafePath,
  sanitizeProjectId,
} from '../config/security.ts';

export interface StoredProjectRecord {
  id: string;
  name: string;
  referenceSubject: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  config?: {
    dimension: '2d' | '3d';
    preferredAiProvider: 'none' | 'ollama' | 'gemini';
    preferredOllamaModel?: string;
  };
  sources: unknown[];
  observations: unknown[];
  analysis: unknown;
  specification: unknown;
  generatedArtifact: {
    id?: string;
    generatedAt?: string;
    checksum?: string;
    spec?: unknown;
    layout?: unknown;
    standaloneHtml?: string;
  } | null;
  history?: Array<{
    id: string;
    timestamp: string;
    action: string;
    actor: string;
    details: string;
  }>;
  validationResults?: unknown;
}

export class LocalProjectStore {
  dataDir: string;
  projectsDir: string;

  constructor(dataDir = path.resolve(process.cwd(), 'data')) {
    this.dataDir = path.resolve(dataDir);
    this.projectsDir = resolveSafePath(this.dataDir, 'projects');
    fs.mkdirSync(this.projectsDir, { recursive: true });
  }

  private getProjectFolder(projectId: string): string {
    const safeId = sanitizeProjectId(projectId);
    return resolveSafePath(this.projectsDir, safeId);
  }

  private getProjectJsonPath(projectId: string): string {
    return resolveSafePath(this.getProjectFolder(projectId), 'project.json');
  }

  getPreviewDir(projectId: string): string {
    return resolveSafePath(this.getProjectFolder(projectId), 'preview');
  }

  listProjects(): StoredProjectRecord[] {
    if (!fs.existsSync(this.projectsDir)) return [];
    const entries = fs.readdirSync(this.projectsDir, { withFileTypes: true });
    const projects: StoredProjectRecord[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const proj = this.getProject(entry.name);
        if (proj) projects.push(proj);
      } catch {
        // Ignore dossiers invalides ou corrompus sans faire planter l'inventaire
      }
    }

    projects.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return projects;
  }

  getProject(projectId: string): StoredProjectRecord | null {
    const jsonPath = this.getProjectJsonPath(projectId);
    if (!fs.existsSync(jsonPath)) return null;
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const parsed = JSON.parse(raw) as StoredProjectRecord;
    return parsed;
  }

  saveProject(project: StoredProjectRecord): StoredProjectRecord {
    assertNoForbiddenKeys(project);
    if (!project || typeof project.name !== 'string' || !project.name.trim()) {
      throw new Error('Nom de projet invalide.');
    }
    const safeId = sanitizeProjectId(project.id);
    const folder = this.getProjectFolder(safeId);
    const previewDir = this.getPreviewDir(safeId);
    fs.mkdirSync(folder, { recursive: true });
    fs.mkdirSync(previewDir, { recursive: true });

    const stamped: StoredProjectRecord = {
      ...project,
      id: safeId,
      name: project.name.trim(),
      updatedAt: new Date().toISOString(),
    };

    const jsonPath = this.getProjectJsonPath(safeId);
    fs.writeFileSync(jsonPath, JSON.stringify(stamped, null, 2), 'utf-8');

    // Synchroniser les fichiers d'aperçu si un artefact HTML5 généré existe
    if (
      stamped.generatedArtifact &&
      typeof stamped.generatedArtifact.standaloneHtml === 'string' &&
      stamped.generatedArtifact.standaloneHtml.length > 0
    ) {
      const indexPath = resolveSafePath(previewDir, 'index.html');
      fs.writeFileSync(indexPath, stamped.generatedArtifact.standaloneHtml, 'utf-8');
      if (stamped.specification) {
        const specPath = resolveSafePath(previewDir, 'spec.json');
        fs.writeFileSync(specPath, JSON.stringify(stamped.specification, null, 2), 'utf-8');
      }
    }

    return stamped;
  }

  renameProject(projectId: string, newName: string): StoredProjectRecord {
    if (typeof newName !== 'string' || !newName.trim()) {
      throw new Error('Le nouveau nom du projet ne peut pas être vide.');
    }
    const existing = this.getProject(projectId);
    if (!existing) {
      throw new Error('Projet introuvable sur le disque.');
    }
    const historyEntry = {
      id: `hist_${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      action: 'Renommage du projet',
      actor: 'utilisateur',
      details: `"${existing.name}" renommé en "${newName.trim()}".`,
    };
    return this.saveProject({
      ...existing,
      name: newName.trim(),
      history: [historyEntry, ...(existing.history || [])].slice(0, 60),
    });
  }

  duplicateProject(projectId: string): StoredProjectRecord {
    const source = this.getProject(projectId);
    if (!source) {
      throw new Error('Projet source introuvable.');
    }
    const now = new Date().toISOString();
    const newId = `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const clone: StoredProjectRecord = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      name: `${source.name} (Copie)`,
      createdAt: now,
      updatedAt: now,
      history: [
        {
          id: `hist_${Date.now().toString(36)}`,
          timestamp: now,
          action: 'Duplication',
          actor: 'utilisateur',
          details: `Dupliqué depuis "${source.name}" (${source.id}).`,
        },
        ...(source.history || []),
      ].slice(0, 60),
    };
    return this.saveProject(clone);
  }

  deleteProject(projectId: string): void {
    const folder = this.getProjectFolder(projectId);
    if (!fs.existsSync(folder)) {
      throw new Error('Projet introuvable.');
    }
    fs.rmSync(folder, { recursive: true, force: false });
  }

  hasPreviewIndex(projectId: string): boolean {
    const previewDir = this.getPreviewDir(projectId);
    const indexPath = resolveSafePath(previewDir, 'index.html');
    return fs.existsSync(indexPath);
  }
}

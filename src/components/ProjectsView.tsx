import React, { useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FolderPlus,
  Pencil,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ReagProject } from '../types/reag';
import { downloadTextFile, slugifyFilename } from '../utils/download';

interface ProjectsViewProps {
  projects: ReagProject[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string, referenceSubject: string, description: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onExportProject: (project: ReagProject) => string;
  onImportProject: (rawJson: string) => void;
  onResetSample: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDuplicateProject,
  onDeleteProject,
  onExportProject,
  onImportProject,
  onResetSample,
}) => {
  const [name, setName] = useState('');
  const [referenceSubject, setReferenceSubject] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onCreateProject(name, referenceSubject, description);
      setName('');
      setReferenceSubject('');
      setDescription('');
      setFeedback({ type: 'ok', text: 'Projet créé et activé.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erreur lors de la création.',
      });
    }
  };

  const handleStartRename = (project: ReagProject) => {
    setConfirmDeleteId(null);
    setEditingId(project.id);
    setEditingName(project.name);
  };

  const handleConfirmRename = (e: React.FormEvent, projectId: string) => {
    e.preventDefault();
    const trimmed = editingName.trim();
    if (!trimmed) {
      setFeedback({ type: 'err', text: 'Le nom du projet ne peut pas être vide.' });
      return;
    }
    try {
      onRenameProject(projectId, trimmed);
      setEditingId(null);
      setEditingName('');
      setFeedback({ type: 'ok', text: 'Projet renommé.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Renommage impossible.',
      });
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      onImportProject(content);
      setFeedback({ type: 'ok', text: `Projet importé depuis ${file.name}.` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Import impossible.',
      });
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-base font-semibold text-slate-900">
          Périmètre méthodologique de REAG V2
        </h2>
        <p className="mt-1.5 text-sm text-slate-600 leading-relaxed max-w-4xl">
          REAG formalise des mécaniques de jeu à partir de vos sources documentaires et
          observations pour reconstruire un jeu 2D original sur HTML5 Canvas. Le système ne
          convertit jamais un jeu commercial complet à partir de son seul nom : sans
          observations vérifiables, le moteur d’analyse bloque la génération.
        </p>
      </div>

      {feedback && (
        <div
          role="status"
          className={`border rounded-lg px-4 py-3 text-sm ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-900">Création rapide</h3>
          <p className="mt-1 text-sm text-slate-600">
            Initialisez un espace d’étude vierge avant d’ajouter vos sources.
          </p>

          <form onSubmit={handleCreate} className="mt-5 space-y-4">
            <div>
              <label htmlFor="proj-name" className="block text-sm font-medium text-slate-800">
                Nom du projet
              </label>
              <input
                id="proj-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. : Prototype Collecteur Orbital"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="proj-subject" className="block text-sm font-medium text-slate-800">
                Sujet de référence étudié
              </label>
              <input
                id="proj-subject"
                type="text"
                value={referenceSubject}
                onChange={(e) => setReferenceSubject(e.target.value)}
                placeholder="Ex. : Archétype arcade vue de dessus"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="proj-desc" className="block text-sm font-medium text-slate-800">
                Objectif de reconstruction
              </label>
              <textarea
                id="proj-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez les mécaniques ciblées et le cadre expérimental."
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                Créer le projet
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileImport}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Importer JSON
              </button>
            </div>
          </form>
        </section>

        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Projets enregistrés</h3>
              <p className="text-xs text-slate-500 tabular-nums">
                {projects.length} projet(s) synchronisé(s) localement
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onResetSample();
                setFeedback({ type: 'ok', text: "Projet d'exemple restauré." });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurer l’exemple
            </button>
          </div>

          <div className="divide-y divide-slate-200">
            {projects.map((project) => {
              const isActive = project.id === activeProjectId;
              const isEditing = editingId === project.id;
              const isConfirmingDelete = confirmDeleteId === project.id;
              return (
                <div
                  key={project.id}
                  className={`p-5 transition-colors space-y-3 ${
                    isActive ? 'bg-slate-50' : 'bg-white hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <form
                          onSubmit={(e) => handleConfirmRename(e, project.id)}
                          className="flex items-center gap-2 flex-wrap"
                        >
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            aria-label="Nouveau nom du projet"
                            className="rounded-lg border border-blue-500 bg-white px-2.5 py-1 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Valider
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            Annuler
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="text-base font-semibold text-slate-900 truncate">
                            {project.name}
                          </h4>
                          {isActive && (
                            <span className="text-xs font-medium text-blue-700">
                              · Projet actif
                            </span>
                          )}
                        </div>
                      )}
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                        {project.description || project.referenceSubject || 'Aucune description.'}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 tabular-nums flex-wrap">
                        <span>{project.sources.length} source(s)</span>
                        <span aria-hidden="true">·</span>
                        <span>{project.observations.length} observation(s)</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {project.generatedArtifact ? 'Jeu généré' : 'Non généré'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Maj {new Date(project.updatedAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => onSelectProject(project.id)}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Ouvrir
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStartRename(project)}
                        title="Renommer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Renommer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const json = onExportProject(project);
                          downloadTextFile(
                            `${slugifyFilename(project.name)}-projet.json`,
                            json,
                            'application/json'
                          );
                        }}
                        title="Exporter le projet en JSON"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Exporter
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateProject(project.id)}
                        title="Dupliquer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Dupliquer
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(project.id)}
                        title="Supprimer"
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Supprimer
                      </button>
                    </div>
                  </div>

                  {isConfirmingDelete && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-xs font-medium text-rose-900">
                        Confirmer la suppression définitive de « {project.name} » ?
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteProject(project.id);
                            setConfirmDeleteId(null);
                            setFeedback({ type: 'ok', text: `Projet « ${project.name} » supprimé.` });
                          }}
                          className="rounded-lg bg-rose-700 px-3 py-1 text-xs font-medium text-white hover:bg-rose-800 cursor-pointer"
                        >
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

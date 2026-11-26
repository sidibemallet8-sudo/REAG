import React, { useRef, useState } from 'react';
import { BookOpen, Plus, Trash2, Upload } from 'lucide-react';
import { ResearchManager } from '../modules/researchManager';
import { DocumentarySource, ReagProject, SourceKind, SourceReliability } from '../types/reag';

interface SourcesViewProps {
  project: ReagProject;
  onUpdateSources: (sources: DocumentarySource[]) => void;
}

const KIND_LABELS: Record<SourceKind, string> = {
  manuel: 'Manuel / Documentation',
  note_gameplay: 'Note de gameplay',
  article_technique: 'Article technique',
  capture_regles: 'Capture de règles',
  fichier_importe: 'Fichier importé',
};

const RELIABILITY_LABELS: Record<SourceReliability, string> = {
  verifiee: 'Vérifiée',
  partielle: 'Partielle',
  hypothese: 'Hypothèse',
};

export const SourcesView: React.FC<SourcesViewProps> = ({ project, onUpdateSources }) => {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<SourceKind>('note_gameplay');
  const [reliability, setReliability] = useState<SourceReliability>('verifiee');
  const [reference, setReference] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [filterRel, setFilterRel] = useState<'all' | SourceReliability>('all');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const next = ResearchManager.addSource(project.sources, {
        title,
        kind,
        reliability,
        reference,
        excerpt,
      });
      onUpdateSources(next);
      setTitle('');
      setReference('');
      setExcerpt('');
      setFeedback({ type: 'ok', text: 'Source documentaire enregistrée.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erreur d’enregistrement.',
      });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const imported = ResearchManager.parseImportedSourceFile(file.name, content);
      onUpdateSources([...imported, ...project.sources]);
      setFeedback({
        type: 'ok',
        text: `${imported.length} source(s) importée(s) depuis ${file.name}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Échec de l’importation.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const visibleSources =
    filterRel === 'all'
      ? project.sources
      : project.sources.filter((s) => s.reliability === filterRel);

  return (
    <div className="space-y-6">
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
          <h3 className="text-lg font-semibold text-slate-900">
            Ajouter une source documentaire
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Chaque règle extraite devrait s’appuyer sur une source traçable.
          </p>

          <form onSubmit={handleAdd} className="mt-5 space-y-4">
            <div>
              <label htmlFor="src-title" className="block text-sm font-medium text-slate-800">
                Titre de la source
              </label>
              <input
                id="src-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. : Manuel — Gestion des collisions"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="src-kind" className="block text-sm font-medium text-slate-800">
                  Nature
                </label>
                <select
                  id="src-kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as SourceKind)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {Object.entries(KIND_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="src-rel" className="block text-sm font-medium text-slate-800">
                  Fiabilité
                </label>
                <select
                  id="src-rel"
                  value={reliability}
                  onChange={(e) => setReliability(e.target.value as SourceReliability)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {Object.entries(RELIABILITY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="src-ref" className="block text-sm font-medium text-slate-800">
                Référence / URL / Archive
              </label>
              <input
                id="src-ref"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="https://... ou chemin documentaire"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="src-excerpt" className="block text-sm font-medium text-slate-800">
                Extrait technique ou règles constatées
              </label>
              <textarea
                id="src-excerpt"
                rows={4}
                required
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Notez précisément les comportements, valeurs ou contraintes décrits par cette source."
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Enregistrer la source
              </button>

              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.json"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Importer (.txt, .md, .json)
              </button>
            </div>
          </form>
        </section>

        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Sources du projet ({visibleSources.length})
              </h3>
              <p className="text-xs text-slate-500">
                Corpus documentaire rattaché à « {project.name} »
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['all', 'verifiee', 'partielle', 'hypothese'] as const).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFilterRel(val)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    filterRel === val
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {val === 'all' ? 'Toutes' : RELIABILITY_LABELS[val]}
                </button>
              ))}
            </div>
          </div>

          {visibleSources.length === 0 ? (
            <div className="p-10 text-center">
              <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="mt-3 text-sm font-medium text-slate-800">
                Aucune source documentaire enregistrée
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Ajoutez un manuel, une note de gameplay ou importez un fichier texte à gauche.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {visibleSources.map((src) => (
                <div key={src.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-slate-900">{src.title}</h4>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                        <span>{KIND_LABELS[src.kind]}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            src.reliability === 'verifiee'
                              ? 'text-emerald-700 font-medium'
                              : src.reliability === 'partielle'
                              ? 'text-amber-700 font-medium'
                              : 'text-slate-600 font-medium'
                          }
                        >
                          Fiabilité : {RELIABILITY_LABELS[src.reliability]}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[11px] truncate max-w-[260px]">
                          {src.reference}
                        </span>
                      </div>
                      <p className="mt-2.5 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                        {src.excerpt}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSources(ResearchManager.removeSource(project.sources, src.id))
                      }
                      aria-label={`Supprimer ${src.title}`}
                      className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-rose-700 hover:border-rose-200 transition-colors shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

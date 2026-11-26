import React, { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Cpu, FileUp, Plus, Trash2 } from 'lucide-react';
import { ObservationEngine } from '../modules/observationEngine';
import {
  GameObservation,
  ObservationCategory,
  ObservationConfidence,
  ReagProject,
} from '../types/reag';

interface AnalysisViewProps {
  project: ReagProject;
  onUpdateObservations: (observations: GameObservation[]) => void;
  onRunAnalysis: () => void;
  onGoToGenerator: () => void;
}

const CATEGORY_LABELS: Record<ObservationCategory, string> = {
  deplacement: 'Déplacement',
  collecte: 'Collecte',
  obstacle: 'Obstacle / Collision',
  danger: 'Danger / Ennemi',
  score: 'Score',
  victoire: 'Victoire',
  defaite: 'Défaite',
  controle: 'Contrôles',
  physique: 'Physique',
};

const CONFIDENCE_LABELS: Record<ObservationConfidence, string> = {
  confirmee: 'Confirmée',
  deduite: 'Déduite',
  incertaine: 'Incertaine',
};

export const AnalysisView: React.FC<AnalysisViewProps> = ({
  project,
  onUpdateObservations,
  onRunAnalysis,
  onGoToGenerator,
}) => {
  const [category, setCategory] = useState<ObservationCategory>('deplacement');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [confidence, setConfidence] = useState<ObservationConfidence>('confirmee');
  const [bulkText, setBulkText] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAddObservation = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const next = ObservationEngine.addObservation(project.observations, {
        category,
        title,
        description,
        sourceId: sourceId || undefined,
        confidence,
      });
      onUpdateObservations(next);
      setTitle('');
      setDescription('');
      setFeedback({ type: 'ok', text: 'Observation enregistrée.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erreur d’ajout.',
      });
    }
  };

  const handleBulkImport = () => {
    const { observations, errors } = ObservationEngine.parseImportedObservations(
      bulkText,
      'auto',
      'saisie-lot'
    );
    if (observations.length > 0) {
      onUpdateObservations([...observations, ...project.observations]);
      setBulkText('');
      setShowBulkImport(false);
    }
    if (errors.length > 0) {
      setFeedback({
        type: 'err',
        text: `${observations.length} importée(s), ${errors.length} erreur(s) : ${errors[0]}`,
      });
    } else {
      setFeedback({
        type: 'ok',
        text: `${observations.length} observation(s) importée(s) avec succès.`,
      });
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const { observations, errors } = ObservationEngine.parseImportedObservations(
        content,
        'auto',
        file.name
      );
      if (observations.length > 0) {
        onUpdateObservations([...observations, ...project.observations]);
      }
      if (errors.length > 0) {
        setFeedback({
          type: 'err',
          text: `${observations.length} importée(s) depuis ${file.name}. Erreur : ${errors[0]}`,
        });
      } else {
        setFeedback({
          type: 'ok',
          text: `${observations.length} observation(s) importée(s) depuis ${file.name}.`,
        });
      }
    } finally {
      e.target.value = '';
    }
  };

  const analysis = project.analysis;

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
        {/* Colonne gauche : Observations */}
        <section className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-slate-900">
                Observations de gameplay
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkImport((v) => !v)}
                className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                {showBulkImport ? 'Formulaire simple' : 'Import CSV / JSON / Texte'}
              </button>
            </div>

            {showBulkImport ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Collez du CSV (<span className="font-mono">categorie;titre;description</span>), du
                  JSON ou des lignes de texte, ou chargez un fichier.
                </p>
                <textarea
                  rows={6}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={
                    'deplacement;Vitesse avatar;Le personnage avance à 220 px/s\ncollecte;Éclats;8 éclats donnent chacun 100 points'
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={handleBulkImport}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Importer le texte
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.json,.txt,.md"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FileUp className="w-4 h-4" />
                    Charger un fichier
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddObservation} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="obs-cat" className="block text-sm font-medium text-slate-800">
                      Catégorie
                    </label>
                    <select
                      id="obs-cat"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ObservationCategory)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="obs-conf" className="block text-sm font-medium text-slate-800">
                      Confiance
                    </label>
                    <select
                      id="obs-conf"
                      value={confidence}
                      onChange={(e) => setConfidence(e.target.value as ObservationConfidence)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {Object.entries(CONFIDENCE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="obs-title" className="block text-sm font-medium text-slate-800">
                    Titre de l’observation
                  </label>
                  <input
                    id="obs-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex. : Déplacement libre à 200 px/s"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label htmlFor="obs-desc" className="block text-sm font-medium text-slate-800">
                    Comportement observé (paramètres numériques détectés auto.)
                  </label>
                  <textarea
                    id="obs-desc"
                    rows={3}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex. : Le joueur se déplace à 210 px/s. Chaque pièce rapporte 50 points."
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label htmlFor="obs-src" className="block text-sm font-medium text-slate-800">
                    Source associée (optionnel)
                  </label>
                  <select
                    id="obs-src"
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">Aucune source rattachée</option>
                    {project.sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter l’observation
                </button>
              </form>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">
                Journal des observations ({project.observations.length})
              </h4>
            </div>
            {project.observations.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                Aucune observation saisie pour ce projet.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 max-h-[420px] overflow-y-auto">
                {project.observations.map((obs) => (
                  <div key={obs.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{obs.title}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                        <span>{CATEGORY_LABELS[obs.category]}</span>
                        <span aria-hidden="true">·</span>
                        <span>{CONFIDENCE_LABELS[obs.confidence]}</span>
                        {obs.sourceId && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-700">Sourcée</span>
                          </>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                        {obs.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateObservations(
                          ObservationEngine.removeObservation(project.observations, obs.id)
                        )
                      }
                      aria-label={`Supprimer ${obs.title}`}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-rose-700 hover:border-rose-200 shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Colonne droite : Moteur d'analyse */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Moteur d’analyse des mécaniques
              </h3>
              <p className="text-xs text-slate-500">
                Extraction déterministe à partir des sources et observations enregistrées
              </p>
            </div>
            <button
              type="button"
              onClick={onRunAnalysis}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Cpu className="w-4 h-4" />
              Lancer l’analyse
            </button>
          </div>

          {!analysis ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-slate-800">
                Aucune analyse exécutée sur l’état actuel.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Cliquez sur « Lancer l’analyse » pour extraire les mécaniques, vérifier la
                traçabilité et détecter les lacunes.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {!analysis.canReconstruct ? (
                <div className="border border-rose-200 bg-rose-50 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-rose-900">
                      Reconstruction bloquée par garde-fou méthodologique
                    </h4>
                    <p className="mt-1 text-sm text-rose-800">{analysis.refusalReason}</p>
                  </div>
                </div>
              ) : (
                <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-emerald-900">
                        Analyse validée pour reconstruction 2D
                      </h4>
                      <p className="mt-0.5 text-xs text-emerald-800 tabular-nums">
                        {analysis.metrics.totalMechanicCount} mécanique(s) extraite(s) ·{' '}
                        {analysis.metrics.sourceTraceabilityRatio}% reliée(s) à une source
                        documentaire
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onGoToGenerator}
                    className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Ouvrir le générateur
                  </button>
                </div>
              )}

              {/* Métriques réelles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-y border-slate-200 py-4">
                <div>
                  <p className="text-xs text-slate-500">Sources</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">
                    {analysis.metrics.sourceCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Observations</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">
                    {analysis.metrics.observationCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Mécaniques</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">
                    {analysis.metrics.totalMechanicCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Traçabilité source</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">
                    {analysis.metrics.sourceTraceabilityRatio}%
                  </p>
                </div>
              </div>

              {/* Mécaniques extraites */}
              {analysis.extractedMechanics.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">
                    Mécaniques formalisées
                  </h4>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                    {analysis.extractedMechanics.map((m) => (
                      <div key={m.id} className="p-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">{m.name}</span>
                          <span
                            className={`text-xs font-medium ${
                              m.sourced ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {m.sourced
                              ? `${m.evidenceSourceIds.length} source(s) · ${m.evidenceObservationIds.length} obs.`
                              : `Non sourcée · ${m.evidenceObservationIds.length} obs.`}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                          {m.ruleSummary}
                        </p>
                        {Object.keys(m.parameters).length > 0 && (
                          <p className="mt-1.5 font-mono text-[11px] text-slate-500">
                            Paramètres : {JSON.stringify(m.parameters)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lacunes réelles */}
              {analysis.gaps.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">
                    Lacunes et hypothèses détectées
                  </h4>
                  <ul className="space-y-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4">
                    {analysis.gaps.map((gap, i) => (
                      <li key={i}>• {gap}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Limites assumées */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-2">
                  Limites structurelles du moteur V1
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-4">
                  {analysis.v1Limitations.map((lim, i) => (
                    <li key={i}>• {lim}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

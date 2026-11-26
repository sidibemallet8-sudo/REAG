import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Hammer,
  Play,
  RefreshCw,
} from 'lucide-react';
import { SpecificationEngine } from '../modules/specificationEngine';
import { ReagGameSpec, ReagProject } from '../types/reag';
import { downloadTextFile, slugifyFilename } from '../utils/download';

interface GeneratorViewProps {
  project: ReagProject;
  onCompileSpec: () => void;
  onUpdateSpec: (spec: ReagGameSpec) => void;
  onGenerateGame: () => void;
  onOpenPreview: () => void;
}

export const GeneratorView: React.FC<GeneratorViewProps> = ({
  project,
  onCompileSpec,
  onUpdateSpec,
  onGenerateGame,
  onOpenPreview,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const spec = project.specification;

  const validation = useMemo(() => {
    if (!spec) return null;
    return SpecificationEngine.validateSpecification(spec);
  }, [spec]);

  const handleFieldChange = (updater: (draft: ReagGameSpec) => ReagGameSpec) => {
    if (!spec) return;
    onUpdateSpec(updater(structuredClone(spec)));
  };

  const handleGenerate = () => {
    try {
      onGenerateGame();
      setFeedback({
        type: 'ok',
        text: 'Jeu 2D généré avec succès. Vous pouvez le tester dans Aperçu du jeu ou l’exporter en HTML.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erreur lors de la génération.',
      });
    }
  };

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

      {!project.analysis || !project.analysis.canReconstruct ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">
            Spécification verrouillée
          </h3>
          <p className="mt-1.5 text-sm text-slate-600 max-w-xl mx-auto">
            Exécutez d’abord une analyse valide dans l’onglet Analyse (avec au moins 2
            observations exploitables) avant de compiler une spécification et générer le jeu.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Colonne gauche : Editeur de spécification */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Spécification formelle (JSON v1.0)
                </h3>
                <p className="text-xs text-slate-500">
                  Ajustez les paramètres dérivés avant reconstruction
                </p>
              </div>
              <button
                type="button"
                onClick={onCompileSpec}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recompiler depuis l’analyse
              </button>
            </div>

            {!spec ? (
              <div className="py-6 text-center">
                <button
                  type="button"
                  onClick={onCompileSpec}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Générer la spécification initiale
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {validation && !validation.valid && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 space-y-1">
                    {validation.errors.map((err, i) => (
                      <p key={i}>• {err}</p>
                    ))}
                  </div>
                )}

                {validation && validation.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
                    {validation.warnings.map((w, i) => (
                      <p key={i}>• {w}</p>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Vitesse du personnage (px/s)
                    </label>
                    <input
                      type="number"
                      min={40}
                      max={600}
                      value={spec.player.speed}
                      onChange={(e) =>
                        handleFieldChange((d) => {
                          d.player.speed = Number(e.target.value) || 120;
                          return d;
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Vies initiales
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={spec.player.initialLives}
                      onChange={(e) =>
                        handleFieldChange((d) => {
                          d.player.initialLives = Number(e.target.value) || 1;
                          return d;
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Nombre d’objets à collecter
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={spec.collectibles.count}
                      onChange={(e) =>
                        handleFieldChange((d) => {
                          d.collectibles.count = Number(e.target.value) || 1;
                          d.rules.targetScore = d.collectibles.count * d.collectibles.pointsPerItem;
                          return d;
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Points par objet
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      step={10}
                      value={spec.collectibles.pointsPerItem}
                      onChange={(e) =>
                        handleFieldChange((d) => {
                          d.collectibles.pointsPerItem = Number(e.target.value) || 10;
                          d.rules.targetScore = d.collectibles.count * d.collectibles.pointsPerItem;
                          return d;
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Obstacles (murs)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={spec.obstacles.count}
                      onChange={(e) =>
                        handleFieldChange((d) => {
                          d.obstacles.count = Number(e.target.value) || 0;
                          return d;
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Dangers mobiles
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={14}
                      value={spec.hazards.count}
                      onChange={(e) =>
                        handleFieldChange((d) => {
                          d.hazards.count = Number(e.target.value) || 0;
                          return d;
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Comportement des dangers
                    </label>
                    <select
                      value={spec.hazards.behavior}
                      onChange={(e) =>
                        handleFieldChange((d) => {
                          d.hazards.behavior = e.target.value as 'patrol_bounce' | 'chase_slow';
                          return d;
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="patrol_bounce">Patrouille à rebond</option>
                      <option value="chase_slow">Poursuite lente</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Chronomètre limite (s, 0 = sans)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={600}
                      value={spec.rules.timeLimitSeconds ?? 0}
                      onChange={(e) =>
                        handleFieldChange((d) => {
                          const v = Number(e.target.value);
                          d.rules.timeLimitSeconds = v > 0 ? v : null;
                          return d;
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={!validation?.valid}
                    onClick={handleGenerate}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Hammer className="w-4 h-4" />
                    Reconstruire le jeu 2D
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile(
                        `${slugifyFilename(spec.title)}-spec.json`,
                        JSON.stringify(spec, null, 2),
                        'application/json'
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Exporter la spec JSON
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Colonne droite : Aperçu JSON & Artefact généré */}
          <section className="lg:col-span-6 space-y-6">
            {project.generatedArtifact && (
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-base font-semibold text-slate-900">
                        Artefact jouable généré
                      </h4>
                      <p className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
                        Empreinte : {project.generatedArtifact.checksum} ·{' '}
                        {project.generatedArtifact.layout.obstacles.length} murs ·{' '}
                        {project.generatedArtifact.layout.collectibles.length} objets ·{' '}
                        {project.generatedArtifact.layout.hazards.length} dangers
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onOpenPreview}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    Lancer dans l’aperçu
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!project.generatedArtifact) return;
                      downloadTextFile(
                        `${slugifyFilename(project.generatedArtifact.spec.title)}-jeu.html`,
                        project.generatedArtifact.standaloneHtml,
                        'text/html'
                      );
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Exporter le jeu (.html autonome)
                  </button>
                </div>
              </div>
            )}

            {spec && (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">
                    Document JSON de spécification
                  </span>
                  <span className="text-xs font-mono text-slate-500">specVersion 1.0</span>
                </div>
                <pre className="p-4 text-xs font-mono text-slate-800 bg-slate-50 overflow-x-auto max-h-[420px] leading-relaxed">
                  {JSON.stringify(spec, null, 2)}
                </pre>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

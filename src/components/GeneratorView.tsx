import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Box,
  CheckCircle2,
  Download,
  Hammer,
  History,
  Layers,
  Play,
  RefreshCw,
} from 'lucide-react';
import { ThreeAdapter } from '../engines/threeAdapter';
import { SpecificationEngine } from '../modules/specificationEngine';
import { buildCommonGameSpecification } from '../types/commonGameSpec';
import { ReagGameSpec, ReagProject } from '../types/reag';
import { downloadTextFile, slugifyFilename } from '../utils/download';

interface GeneratorViewProps {
  project: ReagProject;
  onCompileSpec: () => void;
  onUpdateSpec: (spec: ReagGameSpec) => void;
  onGenerateGame: () => void;
  onOpenPreview: () => void;
}

type EditorTab = 'spec2d' | 'common' | 'three' | 'history';

export const GeneratorView: React.FC<GeneratorViewProps> = ({
  project,
  onCompileSpec,
  onUpdateSpec,
  onGenerateGame,
  onOpenPreview,
}) => {
  const [editorTab, setEditorTab] = useState<EditorTab>('spec2d');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const spec = project.specification;

  const validation = useMemo(() => {
    if (!spec) return null;
    return SpecificationEngine.validateSpecification(spec);
  }, [spec]);

  const commonSpec = useMemo(() => {
    if (!spec || !validation) return null;
    return buildCommonGameSpecification(
      spec,
      project.analysis,
      validation,
      project.config?.dimension || '2d'
    );
  }, [spec, validation, project.analysis, project.config?.dimension]);

  const threePlan = useMemo(() => {
    if (!commonSpec) return null;
    return ThreeAdapter.prepareScenePlan(commonSpec);
  }, [commonSpec]);

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

      {/* Onglets segmentés de l'éditeur de projet */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit flex-wrap">
        <button
          type="button"
          onClick={() => setEditorTab('spec2d')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            editorTab === 'spec2d'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Hammer className="w-3.5 h-3.5" />
          Spécification 2D &amp; Générateur
        </button>
        <button
          type="button"
          onClick={() => setEditorTab('common')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            editorTab === 'common'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Spécification commune 2D/3D
        </button>
        <button
          type="button"
          onClick={() => setEditorTab('three')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            editorTab === 'three'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          Adaptateur Three.js
        </button>
        <button
          type="button"
          onClick={() => setEditorTab('history')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            editorTab === 'history'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Historique &amp; Validations
        </button>
      </div>

      {editorTab === 'history' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Derniers résultats de validation
            </h3>
            {validation ? (
              <div className="space-y-3 text-xs">
                <p className={validation.valid ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                  {validation.valid
                    ? 'Spécification valide pour la génération.'
                    : `Spécification invalide (${validation.errors.length} erreur(s)).`}
                </p>
                {validation.errors.length > 0 && (
                  <ul className="space-y-1 bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-800">
                    {validation.errors.map((e, idx) => (
                      <li key={idx}>• {e}</li>
                    ))}
                  </ul>
                )}
                {validation.warnings.length > 0 && (
                  <ul className="space-y-1 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800">
                    {validation.warnings.map((w, idx) => (
                      <li key={idx}>• {w}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Aucune spécification compilée pour ce projet.
              </p>
            )}
          </section>

          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                Historique MemoryEngine ({project.history?.length || 0})
              </h3>
            </div>
            {!project.history || project.history.length === 0 ? (
              <p className="p-6 text-xs text-slate-500">
                Aucune entrée enregistrée dans la session actuelle.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 max-h-[420px] overflow-y-auto">
                {project.history.map((entry) => (
                  <div key={entry.id} className="px-6 py-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{entry.action}</span>
                      <span className="font-mono text-slate-500 tabular-nums">
                        {entry.actor} · {new Date(entry.timestamp).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <p className="text-slate-600">{entry.details}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : editorTab === 'common' ? (
        !commonSpec ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-600">
            Compilez d’abord une spécification 2D pour produire la Spécification commune 2D/3D.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Spécification commune 2D/3D (schemaVersion {commonSpec.schemaVersion})
                </h3>
                <p className="text-xs text-slate-500">
                  Dimension : {commonSpec.dimension.toUpperCase()} · {commonSpec.mechanics.length}{' '}
                  mécanique(s) · {commonSpec.evidence.length} preuve(s) ·{' '}
                  {commonSpec.uncertainties.length} incertitude(s)
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  downloadTextFile(
                    `${slugifyFilename(commonSpec.title)}-common-spec.json`,
                    JSON.stringify(commonSpec, null, 2),
                    'application/json'
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Exporter CommonSpec JSON
              </button>
            </div>
            <pre className="p-5 text-xs font-mono text-slate-800 bg-slate-50 overflow-x-auto max-h-[540px] leading-relaxed">
              {JSON.stringify(commonSpec, null, 2)}
            </pre>
          </div>
        )
      ) : editorTab === 'three' ? (
        !threePlan ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-600">
            Compilez d’abord une spécification 2D pour préparer le plan de scène Three.js.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Adaptateur structurel Three.js ({threePlan.status})
              </h3>
              <p className="mt-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
                {threePlan.warning}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="border border-slate-200 rounded-lg p-4 space-y-1.5">
                <p className="font-semibold text-slate-900">Configuration caméra préparée</p>
                <p className="font-mono text-slate-600">
                  Type : {threePlan.cameraConfig.type} · FOV {threePlan.cameraConfig.fov}° · Position{' '}
                  [{threePlan.cameraConfig.position.join(', ')}]
                </p>
              </div>
              <div className="border border-slate-200 rounded-lg p-4 space-y-1.5">
                <p className="font-semibold text-slate-900">Noeuds de scène normalisés</p>
                <p className="text-slate-600 tabular-nums">
                  {threePlan.nodes.length} descripteur(s) prêt(s) pour une future scène Three.js
                </p>
              </div>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-lg overflow-x-auto max-h-[400px]">
              {JSON.stringify(threePlan, null, 2)}
            </pre>
          </div>
        )
      ) : !project.analysis || !project.analysis.canReconstruct ? (
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
                      max={700}
                      value={spec.player.speed}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        handleFieldChange((d) => {
                          d.player.speed = v;
                          return d;
                        });
                      }}
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
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        handleFieldChange((d) => {
                          d.player.initialLives = Math.trunc(v);
                          return d;
                        });
                      }}
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
                      max={100}
                      value={spec.collectibles.count}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        handleFieldChange((d) => {
                          d.collectibles.count = Math.trunc(v);
                          if (d.rules.winCondition === 'collect_all') {
                            d.rules.targetScore = d.collectibles.count * d.collectibles.pointsPerItem;
                          }
                          return d;
                        });
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Points par objet
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      step={10}
                      value={spec.collectibles.pointsPerItem}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        handleFieldChange((d) => {
                          d.collectibles.pointsPerItem = v;
                          if (d.rules.winCondition === 'collect_all') {
                            d.rules.targetScore = d.collectibles.count * d.collectibles.pointsPerItem;
                          }
                          return d;
                        });
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Condition de victoire
                    </label>
                    <select
                      value={spec.rules.winCondition}
                      onChange={(e) =>
                        handleFieldChange((d) => {
                          d.rules.winCondition = e.target.value as 'collect_all' | 'target_score';
                          return d;
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="collect_all">Collecter tous les objets</option>
                      <option value="target_score">Atteindre le score cible</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Score cible
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={spec.rules.targetScore}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        handleFieldChange((d) => {
                          d.rules.targetScore = v;
                          return d;
                        });
                      }}
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
                      max={40}
                      value={spec.obstacles.count}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        handleFieldChange((d) => {
                          d.obstacles.count = Math.trunc(v);
                          return d;
                        });
                      }}
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
                      max={30}
                      value={spec.hazards.count}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        handleFieldChange((d) => {
                          d.hazards.count = Math.trunc(v);
                          return d;
                        });
                      }}
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
                      max={3600}
                      value={spec.rules.timeLimitSeconds ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        handleFieldChange((d) => {
                          d.rules.timeLimitSeconds = v > 0 ? v : null;
                          return d;
                        });
                      }}
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

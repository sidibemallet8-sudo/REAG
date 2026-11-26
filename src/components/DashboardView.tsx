import React from 'react';
import {
  CheckCircle2,
  Cpu,
  ExternalLink,
  FolderPlus,
  Gamepad2,
  Hammer,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';
import { ServicesStatusPayload } from '../services/localHostClient';
import { AiProviderId, ReagProject, TestSuiteResult } from '../types/reag';

interface DashboardViewProps {
  activeProject: ReagProject | undefined;
  projectsCount: number;
  servicesStatus: ServicesStatusPayload | null;
  servicesError: string | null;
  selectedAiProvider: AiProviderId;
  lastTestResult: TestSuiteResult;
  isGenerating: boolean;
  onRefreshServices: () => void;
  onNavigate: (tab: string) => void;
  onLaunchPreview: () => void;
}

const PROVIDER_NAMES: Record<AiProviderId, string> = {
  none: 'Sans IA (REAG Core déterministe)',
  ollama: 'Ollama local',
  gemini: 'Gemini (@google/genai serveur)',
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  activeProject,
  projectsCount,
  servicesStatus,
  servicesError,
  selectedAiProvider,
  lastTestResult,
  isGenerating,
  onRefreshServices,
  onNavigate,
  onLaunchPreview,
}) => {
  const localRunning = Boolean(servicesStatus?.localHost.running);
  const preview = servicesStatus?.preview;
  const ollama = servicesStatus?.ai.ollama;
  const gemini = servicesStatus?.ai.gemini;

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              REAG Studio — Environnement local de reconstruction de jeux
            </h2>
            <p className="mt-1 text-sm text-slate-600 max-w-3xl">
              Pilotez vos projets, l’analyse déterministe REAG Core, l’IA hybride facultative et
              le serveur de prévisualisation Chrome sur ports locaux réservés.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={onRefreshServices}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualiser les services
            </button>
            <button
              type="button"
              onClick={() => onNavigate('new-project')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Nouveau projet
            </button>
          </div>
        </div>

        {servicesError && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            REAG Local Host non joignable : {servicesError}
          </div>
        )}
      </section>

      {/* Grille d'état réel (aucune donnée fictive) */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Serveur local</span>
            <Server className="w-4 h-4 text-slate-400" />
          </div>
          <p className="mt-2 flex items-center gap-2 text-base font-semibold text-slate-900">
            {localRunning ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Démarré</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-rose-700 shrink-0" />
                <span>Arrêté</span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {localRunning
              ? `${servicesStatus?.localHost.host}:${servicesStatus?.localHost.port ?? 'auto'}`
              : 'Hors ligne'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Fournisseur IA actif</span>
            <Cpu className="w-4 h-4 text-slate-400" />
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900 truncate">
            {PROVIDER_NAMES[selectedAiProvider]}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Ollama :{' '}
            {ollama?.serviceRunning
              ? `${ollama.models.length} modèle(s)`
              : 'Non démarré'}{' '}
            · Gemini : {gemini?.configured ? 'Clé prête' : 'Non configurée'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Projet actif</span>
            <Hammer className="w-4 h-4 text-slate-400" />
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900 truncate">
            {activeProject ? activeProject.name : 'Aucun projet'}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {isGenerating
              ? 'Génération en cours...'
              : activeProject?.generatedArtifact
              ? `Prêt (${activeProject.config?.dimension?.toUpperCase() || '2D'})`
              : 'Non généré'}{' '}
            · {projectsCount} projet(s)
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tests automatisés</span>
            <Gamepad2 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900 tabular-nums">
            {lastTestResult.passed}/{lastTestResult.total} réussis
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {lastTestResult.failed} échec(s) · {lastTestResult.totalDurationMs} ms
          </p>
        </div>
      </section>

      {/* Raccourcis de workflow */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            Chaîne de reconstruction active
          </h3>
          {activeProject ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-y border-slate-200 py-3 text-xs">
                <div>
                  <span className="text-slate-500">Sources</span>
                  <p className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">
                    {activeProject.sources.length}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Observations</span>
                  <p className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">
                    {activeProject.observations.length}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Spécification</span>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">
                    {activeProject.specification ? 'Compilée' : 'Absente'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Aperçu serveur</span>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">
                    {preview?.running ? `Port ${preview.port}` : 'Arrêté'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('creation')}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  Sources & Observations
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('analysis')}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  Analyse & REAG Core
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('editor')}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  Éditeur de projet
                </button>
                <button
                  type="button"
                  onClick={onLaunchPreview}
                  disabled={!activeProject.generatedArtifact || !localRunning}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Lancer le jeu (Chrome)
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">Créez ou sélectionnez un projet pour démarrer.</p>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-3">
          <h3 className="text-base font-semibold text-slate-900">
            Compatibilité poste 8 Go RAM & Windows 10
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            REAG privilégie le moteur 2D Canvas léger et le noyau déterministe sans IA. Les
            modèles locaux Ollama et la future 3D Three.js sont chargés uniquement à la demande.
          </p>
          {servicesStatus?.system && (
            <p className="text-xs font-mono text-slate-700 tabular-nums">
              Plateforme : {servicesStatus.system.platform} · Node {servicesStatus.system.nodeVersion} ·
              RAM libre {servicesStatus.system.freeMemGb}/{servicesStatus.system.totalMemGb} Go
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

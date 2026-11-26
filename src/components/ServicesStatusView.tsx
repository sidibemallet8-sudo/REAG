import React, { useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  ExternalLink,
  HardDrive,
  Play,
  Power,
  RefreshCw,
  Server,
  Square,
  XCircle,
} from 'lucide-react';
import { LocalHostClient, ServicesStatusPayload } from '../services/localHostClient';
import { ReagProject } from '../types/reag';
import { TestsView } from './TestsView';

interface ServicesStatusViewProps {
  activeProject: ReagProject | undefined;
  servicesStatus: ServicesStatusPayload | null;
  servicesError: string | null;
  previewBusy: boolean;
  onRefreshServices: () => void;
  onStartPreview: () => void;
  onStopPreview: () => void;
}

export const ServicesStatusView: React.FC<ServicesStatusViewProps> = ({
  activeProject,
  servicesStatus,
  servicesError,
  previewBusy,
  onRefreshServices,
  onStartPreview,
  onStopPreview,
}) => {
  const [confirmShutdown, setConfirmShutdown] = useState(false);
  const [shutdownMessage, setShutdownMessage] = useState<string | null>(null);

  const localHost = servicesStatus?.localHost;
  const preview = servicesStatus?.preview;
  const ai = servicesStatus?.ai;
  const sys = servicesStatus?.system;

  const handleConfirmShutdown = async () => {
    try {
      const res = await LocalHostClient.shutdownLocalHost();
      setShutdownMessage(res.message);
      setConfirmShutdown(false);
    } catch (err) {
      setShutdownMessage(
        err instanceof Error ? err.message : 'Erreur lors de la demande d’arrêt.'
      );
      setConfirmShutdown(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              État des services locaux REAG
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Supervision en direct du serveur REAG Local Host, du serveur de prévisualisation de
              jeu, de la disponibilité IA et du profil matériel.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={onRefreshServices}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualiser
            </button>
            {localHost?.running && (
              <button
                type="button"
                onClick={() => setConfirmShutdown(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Power className="w-3.5 h-3.5" />
                Arrêter REAG Local Host
              </button>
            )}
          </div>
        </div>

        {confirmShutdown && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-medium text-rose-900">
              Confirmer l’arrêt propre de REAG Local Host et du serveur d’aperçu ?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleConfirmShutdown()}
                className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-800 cursor-pointer"
              >
                Confirmer l’arrêt
              </button>
              <button
                type="button"
                onClick={() => setConfirmShutdown(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {shutdownMessage && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            {shutdownMessage}
          </div>
        )}

        {servicesError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            REAG Local Host indisponible : {servicesError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* REAG Local Host */}
          <div className="border border-slate-200 rounded-lg p-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Server className="w-4 h-4 text-slate-600" />
                REAG Local Host
              </span>
              {localHost?.running ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  Actif
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
                  <XCircle className="w-4 h-4" />
                  Hors ligne
                </span>
              )}
            </div>
            <dl className="text-xs text-slate-600 space-y-1 tabular-nums">
              <div className="flex justify-between gap-2">
                <dt>Adresse :</dt>
                <dd className="font-mono text-slate-900">
                  {localHost ? `${localHost.host}:${localHost.port ?? 'auto'}` : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Démarré le :</dt>
                <dd className="font-mono text-slate-900">
                  {localHost?.startedAt
                    ? new Date(localHost.startedAt).toLocaleString('fr-FR')
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Projets sur disque :</dt>
                <dd className="font-semibold text-slate-900">
                  {localHost?.projectCount ?? 0}
                </dd>
              </div>
              <div className="pt-1">
                <dt className="text-slate-500">Dossier de données :</dt>
                <dd className="font-mono text-[11px] text-slate-800 break-all">
                  {localHost?.dataDir || '—'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Preview Manager */}
          <div className="border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ExternalLink className="w-4 h-4 text-slate-600" />
                Preview Manager (Serveur de jeu)
              </span>
              {preview?.running ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  Actif
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-500">Arrêté</span>
              )}
            </div>

            <dl className="text-xs text-slate-600 space-y-1 tabular-nums">
              <div className="flex justify-between gap-2">
                <dt>URL locale :</dt>
                <dd className="font-mono text-slate-900">
                  {preview?.url ? (
                    <a
                      href={preview.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 hover:underline"
                    >
                      {preview.url}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Projet servi :</dt>
                <dd className="text-slate-900 truncate max-w-[200px]">
                  {preview?.projectName || 'Aucun'}
                </dd>
              </div>
            </dl>

            {preview?.lastError && (
              <p className="text-xs text-rose-700">{preview.lastError}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={
                  previewBusy || !localHost?.running || !activeProject?.generatedArtifact
                }
                onClick={onStartPreview}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                Démarrer pour le projet actif
              </button>
              {preview?.running && (
                <button
                  type="button"
                  disabled={previewBusy}
                  onClick={onStopPreview}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  Arrêter
                </button>
              )}
            </div>
          </div>

          {/* IA Hybride */}
          <div className="border border-slate-200 rounded-lg p-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Cpu className="w-4 h-4 text-slate-600" />
              Orchestrateur IA hybride
            </div>
            <p className="text-xs text-slate-600">
              Mode sans IA : <strong className="text-emerald-700">Toujours disponible</strong>
            </p>
            <p className="text-xs text-slate-600">
              Ollama local :{' '}
              <strong className="text-slate-900">
                {ai?.ollama.serviceRunning
                  ? `Actif (${ai.ollama.models.join(', ') || '0 modèle'})`
                  : ai?.ollama.installed
                  ? 'Installé mais arrêté'
                  : 'Non installé'}
              </strong>
            </p>
            <p className="text-xs text-slate-600">
              Gemini serveur :{' '}
              <strong className="text-slate-900">
                {ai?.gemini.configured ? `Prêt (${ai.gemini.model})` : 'Clé absente côté serveur'}
              </strong>
            </p>
          </div>

          {/* Profil matériel */}
          <div className="border border-slate-200 rounded-lg p-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <HardDrive className="w-4 h-4 text-slate-600" />
              Profil système &amp; compatibilité 8 Go RAM
            </div>
            <dl className="text-xs text-slate-600 space-y-1 tabular-nums">
              <div className="flex justify-between">
                <dt>Système / Node.js :</dt>
                <dd className="font-mono text-slate-900">
                  {sys ? `${sys.platform} · ${sys.nodeVersion}` : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Mémoire libre / totale :</dt>
                <dd className="font-mono text-slate-900">
                  {sys ? `${sys.freeMemGb} Go / ${sys.totalMemGb} Go` : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Profil léger 8 Go RAM :</dt>
                <dd className="font-medium text-slate-900">
                  {sys ? (sys.compatible8GbProfile ? 'Conforme' : 'Poste > 9 Go') : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <TestsView />
    </div>
  );
};

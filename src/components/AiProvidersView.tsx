import React, { useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  PlusCircle,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { AiObservationProposal } from '../core/types';
import { LocalHostClient, ServicesStatusPayload } from '../services/localHostClient';
import { AiProviderId, ReagProject } from '../types/reag';

interface AiProvidersViewProps {
  project: ReagProject | undefined;
  servicesStatus: ServicesStatusPayload | null;
  selectedProvider: AiProviderId;
  selectedOllamaModel: string;
  onChangeProvider: (provider: AiProviderId, ollamaModel?: string) => void;
  onRefreshServices: () => void;
  onConvertProposalToObservation: (proposal: AiObservationProposal) => void;
}

export const AiProvidersView: React.FC<AiProvidersViewProps> = ({
  project,
  servicesStatus,
  selectedProvider,
  selectedOllamaModel,
  onChangeProvider,
  onRefreshServices,
  onConvertProposalToObservation,
}) => {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<AiObservationProposal[]>([]);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [convertedIndexes, setConvertedIndexes] = useState<number[]>([]);
  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<{
    ok: boolean;
    provider: AiProviderId;
    message: string;
  } | null>(null);

  const ollama = servicesStatus?.ai.ollama;
  const gemini = servicesStatus?.ai.gemini;
  const effectiveOllamaModel =
    selectedOllamaModel || ollama?.models[0] || '';

  const handleTestConnection = async () => {
    setTestingConn(true);
    setConnResult(null);
    try {
      const res = await LocalHostClient.testAiConnection({
        provider: selectedProvider,
        model: selectedProvider === 'ollama' ? effectiveOllamaModel : undefined,
      });
      setConnResult({
        ok: res.ok,
        provider: res.provider,
        message: res.message,
      });
    } catch (err) {
      setConnResult({
        ok: false,
        provider: selectedProvider,
        message:
          err instanceof Error
            ? err.message
            : 'Erreur lors du test de connexion au fournisseur IA.',
      });
    } finally {
      setTestingConn(false);
    }
  };

  const handleRequestProposals = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setConvertedIndexes([]);
    try {
      const response = await LocalHostClient.requestAiProposals({
        provider: selectedProvider,
        model: selectedProvider === 'ollama' ? effectiveOllamaModel : undefined,
        projectName: project?.name || 'Projet REAG',
        notes,
      });
      setProposals(response.proposals);
      setDisclaimer(response.disclaimer);
      setModelUsed(response.modelUsed);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible d’obtenir des propositions depuis le fournisseur IA.'
      );
      setProposals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = (proposal: AiObservationProposal, index: number) => {
    onConvertProposalToObservation(proposal);
    setConvertedIndexes((prev) => (prev.includes(index) ? prev : [...prev, index]));
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Fournisseurs IA hybrides &amp; mode sans IA
            </h2>
            <p className="mt-1 text-sm text-slate-600 max-w-3xl">
              REAG Core reste entièrement opérationnel sans IA. Lorsque vous activez Ollama local
              ou Gemini côté serveur, l’IA fournit uniquement des propositions d’observations
              soumises à validation humaine.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              disabled={testingConn}
              onClick={() => void handleTestConnection()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5" />
              {testingConn ? 'Test en cours...' : `Tester la connexion (${selectedProvider})`}
            </button>
            <button
              type="button"
              onClick={onRefreshServices}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Détecter les fournisseurs
            </button>
          </div>
        </div>

        {connResult && (
          <div
            role="status"
            className={`rounded-lg border px-4 py-3 text-xs ${
              connResult.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            <strong>Test {connResult.provider} :</strong> {connResult.message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Mode Sans IA */}
          <div
            className={`border rounded-lg p-4 space-y-3 ${
              selectedProvider === 'none'
                ? 'border-blue-600 bg-blue-50/40'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Cpu className="w-4 h-4 text-slate-700" />
                Sans IA (REAG Core)
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Extraction et validation 100% déterministes hors ligne. Aucun appel modèle ni
              consommation mémoire supplémentaire.
            </p>
            <button
              type="button"
              onClick={() => onChangeProvider('none')}
              className={`w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                selectedProvider === 'none'
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {selectedProvider === 'none' ? 'Fournisseur actif' : 'Utiliser Sans IA'}
            </button>
          </div>

          {/* Ollama local */}
          <div
            className={`border rounded-lg p-4 space-y-3 ${
              selectedProvider === 'ollama'
                ? 'border-blue-600 bg-blue-50/40'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Bot className="w-4 h-4 text-slate-700" />
                Ollama local
              </span>
              {ollama?.serviceRunning ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <p>
                Binaire :{' '}
                <strong className="text-slate-900">
                  {ollama?.installed ? 'Installé' : 'Non détecté'}
                </strong>{' '}
                · Service :{' '}
                <strong className="text-slate-900">
                  {ollama?.serviceRunning ? 'En ligne' : 'Arrêté'}
                </strong>
              </p>
              <p className="tabular-nums">
                Modèles disponibles : {ollama?.models.length ?? 0}
              </p>
              {ollama?.error && <p className="text-amber-700">{ollama.error}</p>}
            </div>

            {ollama && ollama.models.length > 0 && (
              <div>
                <label htmlFor="ollama-model" className="block text-[11px] font-medium text-slate-700">
                  Modèle local
                </label>
                <select
                  id="ollama-model"
                  value={effectiveOllamaModel}
                  onChange={(e) => onChangeProvider('ollama', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                >
                  {ollama.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => onChangeProvider('ollama', effectiveOllamaModel || undefined)}
              className={`w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                selectedProvider === 'ollama'
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {selectedProvider === 'ollama' ? 'Fournisseur actif' : 'Sélectionner Ollama'}
            </button>
          </div>

          {/* Gemini serveur */}
          <div
            className={`border rounded-lg p-4 space-y-3 ${
              selectedProvider === 'gemini'
                ? 'border-blue-600 bg-blue-50/40'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Sparkles className="w-4 h-4 text-slate-700" />
                Gemini (serveur)
              </span>
              {gemini?.configured ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <p>
                Modèle : <span className="font-mono">{gemini?.model || 'gemini-4-hydrogen'}</span>
              </p>
              <p>
                {gemini?.message ||
                  'Clé gérée exclusivement côté serveur via GEMINI_API_KEY.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChangeProvider('gemini')}
              className={`w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                selectedProvider === 'gemini'
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {selectedProvider === 'gemini' ? 'Fournisseur actif' : 'Sélectionner Gemini'}
            </button>
          </div>
        </div>

        {servicesStatus?.ai.ramAdvisory && (
          <p className="text-xs text-slate-500 border-t border-slate-200 pt-3">
            Recommandation matériel (8 Go RAM) : {servicesStatus.ai.ramAdvisory}
          </p>
        )}
      </section>

      {/* Assistant de propositions non autoritaires */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Tester et convertir des propositions d’observations
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Décrivez librement des notes documentaires pour générer des suggestions structurées via
            le fournisseur sélectionné ({selectedProvider}). Aucune mécanique n’est intégrée
            automatiquement sans votre validation explicite.
          </p>
        </div>

        <form onSubmit={handleRequestProposals} className="space-y-4">
          <div>
            <label htmlFor="ai-notes" className="block text-sm font-medium text-slate-800">
              Notes ou extraits bruts à structurer ({project ? `Projet : ${project.name}` : 'Aucun projet'})
            </label>
            <textarea
              id="ai-notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex. : Le joueur se déplace librement dans une arène fermée à environ 220 px/s. Il ramasse 10 gemmes à 50 points tout en esquivant 3 drones patrouilleurs."
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? 'Génération des propositions...' : 'Demander des propositions'}
          </button>
        </form>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        {disclaimer && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            {disclaimer}
            {modelUsed ? ` · Modèle utilisé : ${modelUsed}` : ''}
          </div>
        )}

        {proposals.length > 0 && (
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
            {proposals.map((prop, index) => {
              const converted = convertedIndexes.includes(index);
              return (
                <div
                  key={`${prop.title}_${index}`}
                  className="p-4 flex items-start justify-between gap-4 flex-wrap"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{prop.title}</span>
                      <span aria-hidden="true">·</span>
                      <span>Catégorie : {prop.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-700 font-medium">Hypothèse (incertaine)</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{prop.description}</p>
                    <p className="text-[11px] text-slate-500">
                      Justification : {prop.rationale}
                    </p>
                    {prop.parameters && Object.keys(prop.parameters).length > 0 && (
                      <p className="font-mono text-[11px] text-slate-500">
                        Paramètres : {JSON.stringify(prop.parameters)}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!project || converted}
                    onClick={() => handleConvert(prop, index)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    {converted ? 'Ajoutée au projet' : 'Convertir en observation'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

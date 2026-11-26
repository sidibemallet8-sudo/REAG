import React, { useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { AiProviderId } from '../types/reag';

interface NewProjectViewProps {
  onCreateProject: (input: {
    name: string;
    referenceSubject: string;
    description: string;
    dimension: '2d' | '3d';
    preferredAiProvider: AiProviderId;
  }) => void;
}

export const NewProjectView: React.FC<NewProjectViewProps> = ({ onCreateProject }) => {
  const [name, setName] = useState('');
  const [referenceSubject, setReferenceSubject] = useState('');
  const [description, setDescription] = useState('');
  const [dimension, setDimension] = useState<'2d' | '3d'>('2d');
  const [preferredAiProvider, setPreferredAiProvider] = useState<AiProviderId>('none');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le nom du projet est obligatoire.');
      return;
    }
    setError(null);
    onCreateProject({
      name,
      referenceSubject,
      description,
      dimension,
      preferredAiProvider,
    });
  };

  return (
    <div className="max-w-3xl bg-white border border-slate-200 rounded-lg p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Créer un nouveau projet REAG</h2>
        <p className="mt-1 text-sm text-slate-600">
          Définissez le cadre du projet. Conformément à la règle REAG, aucune mécanique ne sera
          générée sans sources ni observations explicites.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="np-name" className="block text-sm font-medium text-slate-800">
            Nom du projet
          </label>
          <input
            id="np-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. : Station Astéroïde 2D"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="np-ref" className="block text-sm font-medium text-slate-800">
            Sujet ou archétype de référence étudié
          </label>
          <input
            id="np-ref"
            type="text"
            value={referenceSubject}
            onChange={(e) => setReferenceSubject(e.target.value)}
            placeholder="Ex. : Jeu d'esquive et collecte en arène fermée"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="np-desc" className="block text-sm font-medium text-slate-800">
            Description et objectifs
          </label>
          <textarea
            id="np-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Précisez les mécaniques visées et le périmètre documentaire."
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="np-dim" className="block text-sm font-medium text-slate-800">
              Dimension cible (Spécification commune)
            </label>
            <select
              id="np-dim"
              value={dimension}
              onChange={(e) => setDimension(e.target.value as '2d' | '3d')}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="2d">2D — HTML5 Canvas (Moteur actif)</option>
              <option value="3d">3D — Préparation adaptateur Three.js</option>
            </select>
          </div>

          <div>
            <label htmlFor="np-ai" className="block text-sm font-medium text-slate-800">
              Fournisseur IA préféré
            </label>
            <select
              id="np-ai"
              value={preferredAiProvider}
              onChange={(e) => setPreferredAiProvider(e.target.value as AiProviderId)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="none">Sans IA (100% déterministe REAG Core)</option>
              <option value="ollama">Ollama local (si installé)</option>
              <option value="gemini">Gemini (serveur @google/genai)</option>
            </select>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            Créer et ouvrir dans Création de jeu
          </button>
        </div>
      </form>
    </div>
  );
};

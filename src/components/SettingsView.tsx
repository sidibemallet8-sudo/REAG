import React from 'react';
import { RotateCcw } from 'lucide-react';
import { ReagSettings } from '../types/reag';

interface SettingsViewProps {
  settings: ReagSettings;
  onUpdateSettings: (next: ReagSettings) => void;
  onResetWorkspace: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetWorkspace,
}) => {
  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Paramètres de l’atelier REAG
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Préférences locales conservées dans le stockage du navigateur.
          </p>
        </div>

        <div className="divide-y divide-slate-200 border-t border-slate-200">
          <label className="py-4 flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Effets sonores synthétiques (Web Audio API)
              </p>
              <p className="text-xs text-slate-500">
                Signaux audio légers lors des collectes, collisions et fins de partie.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) =>
                onUpdateSettings({ ...settings, soundEnabled: e.target.checked })
              }
              className="w-4 h-4 accent-blue-600"
            />
          </label>

          <label className="py-4 flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Afficher les vecteurs de vitesse dans le runtime
              </p>
              <p className="text-xs text-slate-500">
                Trace la direction instantanée du joueur et des sentinelles sur le Canvas.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.showRuntimeDebugVectors}
              onChange={(e) =>
                onUpdateSettings({ ...settings, showRuntimeDebugVectors: e.target.checked })
              }
              className="w-4 h-4 accent-blue-600"
            />
          </label>

          <label className="py-4 flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Ré-analyse automatique après modification des sources ou observations
              </p>
              <p className="text-xs text-slate-500">
                Met à jour le rapport d’analyse immédiatement après un ajout ou un import.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoAnalyzeOnImport}
              onChange={(e) =>
                onUpdateSettings({ ...settings, autoAnalyzeOnImport: e.target.checked })
              }
              className="w-4 h-4 accent-blue-600"
            />
          </label>
        </div>

        <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-slate-900">
              Réinitialiser l’espace de travail
            </p>
            <p className="text-xs text-slate-500">
              Efface les projets locaux et restaure uniquement le projet d’exemple.
            </p>
          </div>
          <button
            type="button"
            onClick={onResetWorkspace}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Réinitialiser les données
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Architecture documentée et installation
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-700">
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-900">Modules implémentés</h4>
            <ul className="space-y-1 text-xs leading-relaxed text-slate-600">
              <li>A. Project Manager — Persistance locale, CRUD et export/import JSON.</li>
              <li>B. Research Manager — Sources documentaires et import TXT/MD/JSON.</li>
              <li>C. Observation Engine — Saisie et parsing CSV/JSON/texte.</li>
              <li>D. Game Analysis Engine — Extraction traçable et garde-fou nom seul.</li>
              <li>E. Specification Engine — Schéma JSON v1.0 et validation stricte.</li>
              <li>F. Game Generator — Niveau déterministe et export HTML5 autonome.</li>
              <li>G. Game Runtime — Moteur 2D HTML5 Canvas, clavier et tactile.</li>
              <li>H. Testing Engine — Tests automatisés navigateur et CLI.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-slate-900">Commandes locales</h4>
            <pre className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 overflow-x-auto leading-relaxed">
{`npm install
npm run dev      # Serveur local port 3000
npm run lint     # Vérification TypeScript
npm test         # Suite de tests CLI
npm run build    # Compilation production`}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
};

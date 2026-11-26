import React, { useState } from 'react';
import { CheckCircle2, Play, XCircle } from 'lucide-react';
import { TestingEngine, V1_CAPABILITY_AUDIT } from '../modules/testingEngine';
import { TestSuiteResult } from '../types/reag';

export const TestsView: React.FC = () => {
  const [results, setResults] = useState<TestSuiteResult>(() => TestingEngine.runAllTests());

  const handleRun = () => {
    setResults(TestingEngine.runAllTests());
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Suite de tests automatisés REAG V1
            </h3>
            <p className="mt-1 text-xs text-slate-500 tabular-nums">
              Dernière exécution : {new Date(results.executedAt).toLocaleString('fr-FR')} · Durée
              totale : {results.totalDurationMs} ms
            </p>
          </div>
          <button
            type="button"
            onClick={handleRun}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Exécuter tous les tests
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4 border-t border-slate-200 pt-4">
          <div>
            <p className="text-xs text-slate-500">Tests exécutés</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
              {results.total}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Réussis</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700 tabular-nums">
              {results.passed}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Échecs</p>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums ${
                results.failed > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {results.failed}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h4 className="text-base font-semibold text-slate-900">
            Résultats détaillés par module
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Vérification</th>
                <th className="py-3 px-4">Preuve / Résultat</th>
                <th className="py-3 px-4 text-right">Durée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {results.cases.map((tc) => (
                <tr key={tc.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 whitespace-nowrap">
                    {tc.passed ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" />
                        Réussi
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                        <XCircle className="w-4 h-4" />
                        Échec
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                    {tc.module}
                  </td>
                  <td className="py-3 px-4 text-slate-800">{tc.name}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    {tc.error ? (
                      <span className="text-rose-700 font-medium">{tc.error}</span>
                    ) : (
                      tc.details
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                    {tc.durationMs.toFixed(2)} ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h4 className="text-base font-semibold text-slate-900">
            État réel d’implémentation et limites connues (V1)
          </h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Transparence technique sur ce qui est opérationnel, partiel ou absent dans cette
            première version
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Capacité</th>
                <th className="py-3 px-4">État réel</th>
                <th className="py-3 px-4">Précisions & limites</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {V1_CAPABILITY_AUDIT.map((item) => (
                <tr key={item.module}>
                  <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                    {item.module}
                  </td>
                  <td className="py-3 px-4 text-slate-800">{item.feature}</td>
                  <td className="py-3 px-4 whitespace-nowrap text-xs font-semibold">
                    {item.status === 'implemente' ? (
                      <span className="text-emerald-700">Implémenté</span>
                    ) : item.status === 'partiel' ? (
                      <span className="text-amber-700">Partiel (V1)</span>
                    ) : (
                      <span className="text-rose-700">Non implémenté</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

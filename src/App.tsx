import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BookOpen,
  Bot,
  Cpu,
  FolderKanban,
  FolderPlus,
  Gamepad2,
  Hammer,
  LayoutDashboard,
  Menu,
  Settings,
  X,
} from 'lucide-react';
import { AiProvidersView } from './components/AiProvidersView';
import { AnalysisView } from './components/AnalysisView';
import { DashboardView } from './components/DashboardView';
import { GamePreviewView } from './components/GamePreviewView';
import { GeneratorView } from './components/GeneratorView';
import { NewProjectView } from './components/NewProjectView';
import { ProjectsView } from './components/ProjectsView';
import { ServicesStatusView } from './components/ServicesStatusView';
import { SettingsView } from './components/SettingsView';
import { SourcesView } from './components/SourcesView';
import { MemoryEngine } from './core/reagCore';
import { AiObservationProposal } from './core/types';
import { GameAnalysisEngine } from './modules/analysisEngine';
import { GameGenerator } from './modules/gameGenerator';
import { ObservationEngine } from './modules/observationEngine';
import { ProjectManager } from './modules/projectManager';
import { SpecificationEngine } from './modules/specificationEngine';
import { TestingEngine } from './modules/testingEngine';
import { LocalHostClient, ServicesStatusPayload } from './services/localHostClient';
import {
  AiProviderId,
  DocumentarySource,
  GameObservation,
  ReagGameSpec,
  ReagProject,
  ReagSettings,
} from './types/reag';

type NavTab =
  | 'dashboard'
  | 'projects'
  | 'new-project'
  | 'creation'
  | 'analysis'
  | 'editor'
  | 'preview'
  | 'ai-providers'
  | 'settings'
  | 'services';

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'projects', label: 'Mes projets', icon: FolderKanban },
  { id: 'new-project', label: 'Nouveau projet', icon: FolderPlus },
  { id: 'creation', label: 'Création de jeu', icon: BookOpen },
  { id: 'analysis', label: 'Analyse et reconstruction', icon: Cpu },
  { id: 'editor', label: 'Éditeur de projet', icon: Hammer },
  { id: 'preview', label: 'Aperçu du jeu', icon: Gamepad2 },
  { id: 'ai-providers', label: 'Fournisseurs IA', icon: Bot },
  { id: 'settings', label: 'Paramètres', icon: Settings },
  { id: 'services', label: 'État des services locaux', icon: Activity },
];

const projectManager = new ProjectManager();

function hydrateInitialSample(projects: ReagProject[]): ReagProject[] {
  let changed = false;
  const hydrated = projects.map((p) => {
    const needsV2Rehydrate =
      p.id === 'proj_labyrinthe_eclats' &&
      p.observations.length >= 2 &&
      (!p.generatedArtifact ||
        !p.analysis ||
        !Array.isArray(p.analysis.contradictions) ||
        !p.generatedArtifact.layout.diagnostics);
    if (needsV2Rehydrate) {
      changed = true;
      const analysis = GameAnalysisEngine.analyzeProject(p);
      const spec = SpecificationEngine.buildSpecification(p, analysis);
      const artifact = GameGenerator.generateGame(spec);
      const validationResults = SpecificationEngine.validateSpecification(spec);
      return {
        ...p,
        config: p.config || { dimension: '2d', preferredAiProvider: 'none' },
        analysis,
        specification: spec,
        generatedArtifact: artifact,
        validationResults,
      };
    }
    return p;
  });
  if (changed) {
    projectManager.saveProjects(hydrated);
  }
  return hydrated;
}

export default function App() {
  const [projects, setProjects] = useState<ReagProject[]>(() =>
    hydrateInitialSample(projectManager.loadProjects())
  );
  const [activeProjectId, setActiveProjectId] = useState<string>(() =>
    projectManager.getActiveProjectId(projectManager.loadProjects())
  );
  const [settings, setSettings] = useState<ReagSettings>(() => projectManager.loadSettings());
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [servicesStatus, setServicesStatus] = useState<ServicesStatusPayload | null>(null);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const lastTestResult = useMemo(() => TestingEngine.runAllTests(), []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || projects[0],
    [projects, activeProjectId]
  );

  const selectedAiProvider: AiProviderId =
    activeProject?.config?.preferredAiProvider || 'none';
  const selectedOllamaModel: string =
    activeProject?.config?.preferredOllamaModel || '';

  const refreshServices = useCallback(async () => {
    try {
      const status = await LocalHostClient.getServicesStatus();
      setServicesStatus(status);
      setServicesError(null);
    } catch (err) {
      setServicesError(
        err instanceof Error ? err.message : 'Service local inaccessible.'
      );
    }
  }, []);

  // Synchronisation initiale avec REAG Local Host (disque <-> navigateur)
  useEffect(() => {
    let cancelled = false;

    const bootstrapFromLocalHost = async () => {
      await refreshServices();
      try {
        const diskProjects = await LocalHostClient.listProjects();
        if (cancelled) return;
        if (diskProjects.length > 0) {
          const hydrated = hydrateInitialSample(diskProjects);
          projectManager.saveProjects(hydrated);
          setProjects(hydrated);
          setActiveProjectId(projectManager.getActiveProjectId(hydrated));
        } else {
          // Peuple le disque avec les projets initiaux (exemple inclus)
          const currentLocal = hydrateInitialSample(projectManager.loadProjects());
          for (const p of currentLocal) {
            await LocalHostClient.saveProject(p);
          }
          await refreshServices();
        }
      } catch {
        // Mode repli localStorage si REAG Local Host n'est pas joignable
      }
    };

    void bootstrapFromLocalHost();
    return () => {
      cancelled = true;
    };
  }, [refreshServices]);

  const syncProjectToDisk = useCallback((proj: ReagProject) => {
    void LocalHostClient.saveProject(proj)
      .then(() => refreshServices())
      .catch(() => {
        // Ignore si serveur local hors ligne (persistance localStorage maintenue)
      });
  }, [refreshServices]);

  const commitProjectUpdate = (
    updated: ReagProject,
    historyAction?: { action: string; actor: 'utilisateur' | 'reag_core' | 'ia_proposition' | 'systeme'; details: string }
  ) => {
    const withHistory: ReagProject = historyAction
      ? {
          ...updated,
          history: MemoryEngine.appendHistory(
            updated.history,
            MemoryEngine.createHistoryEntry(
              historyAction.action,
              historyAction.actor,
              historyAction.details
            )
          ),
        }
      : updated;

    const nextList = projectManager.updateProject(withHistory);
    setProjects(nextList);
    const saved = nextList.find((p) => p.id === withHistory.id) || withHistory;
    syncProjectToDisk(saved);
  };

  const handleSelectProject = (id: string) => {
    projectManager.setActiveProjectId(id);
    setActiveProjectId(id);
  };

  const handleCreateProject = (
    name: string,
    referenceSubject: string,
    description: string,
    config?: { dimension: '2d' | '3d'; preferredAiProvider: AiProviderId }
  ) => {
    const created = projectManager.createProject(name, referenceSubject, description);
    const configured: ReagProject = {
      ...created,
      config: config || { dimension: '2d', preferredAiProvider: 'none' },
      history: [
        MemoryEngine.createHistoryEntry(
          'Création du projet',
          'utilisateur',
          `Projet initialisé en mode ${(config?.dimension || '2d').toUpperCase()} (IA : ${
            config?.preferredAiProvider || 'none'
          }).`
        ),
      ],
    };
    const nextList = projectManager.updateProject(configured);
    setProjects(nextList);
    setActiveProjectId(configured.id);
    syncProjectToDisk(configured);
    setActiveTab('creation');
  };

  const handleRenameProject = (id: string, nextName: string) => {
    const target = projects.find((p) => p.id === id);
    if (!target) return;
    const renamed: ReagProject = {
      ...target,
      name: nextName.trim(),
      history: MemoryEngine.appendHistory(
        target.history,
        MemoryEngine.createHistoryEntry(
          'Renommage du projet',
          'utilisateur',
          `Nouveau nom : ${nextName.trim()}`
        )
      ),
    };
    const nextList = projectManager.updateProject(renamed);
    setProjects(nextList);
    void LocalHostClient.renameProject(id, nextName.trim())
      .then(() => refreshServices())
      .catch(() => syncProjectToDisk(renamed));
  };

  const handleDuplicateProject = (id: string) => {
    const cloned = projectManager.duplicateProject(id);
    if (cloned) {
      setProjects(projectManager.loadProjects());
      setActiveProjectId(cloned.id);
      syncProjectToDisk(cloned);
    }
  };

  const handleDeleteProject = (id: string) => {
    const remaining = projectManager.deleteProject(id);
    setProjects(remaining);
    setActiveProjectId(projectManager.getActiveProjectId(remaining));
    void LocalHostClient.deleteProject(id)
      .then(() => {
        if (remaining.length === 1 && remaining[0].id !== id) {
          return LocalHostClient.saveProject(remaining[0]);
        }
        return undefined;
      })
      .then(() => refreshServices())
      .catch(() => {
        // Fallback localStorage uniquement
      });
  };

  const handleImportProject = (rawJson: string) => {
    const imported = projectManager.importProjectJson(rawJson);
    setProjects(projectManager.loadProjects());
    setActiveProjectId(imported.id);
    syncProjectToDisk(imported);
  };

  const handleResetWorkspace = () => {
    const reset = hydrateInitialSample(projectManager.resetWorkspaceToSample());
    setProjects(reset);
    setActiveProjectId(reset[0].id);
    syncProjectToDisk(reset[0]);
    setActiveTab('projects');
  };

  const handleUpdateSources = (sources: DocumentarySource[]) => {
    if (!activeProject) return;
    let next: ReagProject = { ...activeProject, sources };
    if (settings.autoAnalyzeOnImport && next.observations.length > 0) {
      next = { ...next, analysis: GameAnalysisEngine.analyzeProject(next) };
    }
    commitProjectUpdate(next, {
      action: 'Mise à jour des sources',
      actor: 'utilisateur',
      details: `${sources.length} source(s) documentaire(s) enregistrée(s).`,
    });
  };

  const handleUpdateObservations = (observations: GameObservation[]) => {
    if (!activeProject) return;
    let next: ReagProject = { ...activeProject, observations };
    if (settings.autoAnalyzeOnImport) {
      next = { ...next, analysis: GameAnalysisEngine.analyzeProject(next) };
    }
    commitProjectUpdate(next, {
      action: 'Mise à jour des observations',
      actor: 'utilisateur',
      details: `${observations.length} observation(s) enregistrée(s).`,
    });
  };

  const handleRunAnalysis = () => {
    if (!activeProject) return;
    const analysis = GameAnalysisEngine.analyzeProject(activeProject);
    const specification =
      analysis.canReconstruct
        ? SpecificationEngine.buildSpecification(activeProject, analysis, activeProject.specification)
        : activeProject.specification;
    const validationResults = specification
      ? SpecificationEngine.validateSpecification(specification)
      : null;

    commitProjectUpdate(
      {
        ...activeProject,
        analysis,
        specification,
        validationResults,
      },
      {
        action: 'Analyse REAG Core exécutée',
        actor: 'reag_core',
        details: analysis.canReconstruct
          ? `${analysis.metrics.totalMechanicCount} mécanique(s) extraite(s), traçabilité ${analysis.metrics.sourceTraceabilityRatio}%.`
          : analysis.refusalReason || 'Reconstruction bloquée.',
      }
    );
  };

  const handleCompileSpec = () => {
    if (!activeProject || !activeProject.analysis) return;
    const specification = SpecificationEngine.buildSpecification(
      activeProject,
      activeProject.analysis
    );
    const validationResults = SpecificationEngine.validateSpecification(specification);
    commitProjectUpdate(
      {
        ...activeProject,
        specification,
        validationResults,
      },
      {
        action: 'Compilation de la spécification',
        actor: 'reag_core',
        details: validationResults.valid
          ? 'Spécification JSON compilée et validée.'
          : `${validationResults.errors.length} erreur(s) de validation.`,
      }
    );
  };

  const handleUpdateSpec = (specification: ReagGameSpec) => {
    if (!activeProject) return;
    const validationResults = SpecificationEngine.validateSpecification(specification);
    commitProjectUpdate({
      ...activeProject,
      specification,
      validationResults,
    });
  };

  const handleGenerateGame = () => {
    if (!activeProject || !activeProject.specification) return;
    setIsGenerating(true);
    try {
      const generatedArtifact = GameGenerator.generateGame(activeProject.specification);
      const validationResults = SpecificationEngine.validateSpecification(
        activeProject.specification
      );
      commitProjectUpdate(
        {
          ...activeProject,
          generatedArtifact,
          validationResults,
        },
        {
          action: 'Génération du jeu 2D',
          actor: 'systeme',
          details: `Artefact généré (empreinte ${generatedArtifact.checksum}) avec ${generatedArtifact.layout.collectibles.length} objets et ${generatedArtifact.layout.obstacles.length} murs.`,
        }
      );
    } catch (err) {
      commitProjectUpdate(
        {
          ...activeProject,
          generatedArtifact: null,
        },
        {
          action: 'Échec génération du jeu',
          actor: 'systeme',
          details: err instanceof Error ? err.message : 'Erreur inconnue.',
        }
      );
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartPreview = async (openBrowser = true) => {
    if (!activeProject) return;
    setPreviewBusy(true);
    try {
      // Garantit que le fichier preview/index.html est écrit sur disque avant démarrage
      await LocalHostClient.saveProject(activeProject);
      await LocalHostClient.startPreview(activeProject.id, openBrowser);
      await refreshServices();
    } catch (err) {
      setServicesError(
        err instanceof Error ? err.message : "Impossible de démarrer l'aperçu local."
      );
      await refreshServices();
    } finally {
      setPreviewBusy(false);
    }
  };

  const handleStopPreview = async () => {
    setPreviewBusy(true);
    try {
      await LocalHostClient.stopPreview();
      await refreshServices();
    } finally {
      setPreviewBusy(false);
    }
  };

  const handleChangeAiProvider = (provider: AiProviderId, ollamaModel?: string) => {
    if (!activeProject) return;
    commitProjectUpdate(
      {
        ...activeProject,
        config: {
          dimension: activeProject.config?.dimension || '2d',
          preferredAiProvider: provider,
          preferredOllamaModel:
            ollamaModel ?? activeProject.config?.preferredOllamaModel,
        },
      },
      {
        action: 'Changement de fournisseur IA',
        actor: 'utilisateur',
        details: `Fournisseur sélectionné : ${provider}${
          ollamaModel ? ` (${ollamaModel})` : ''
        }.`,
      }
    );
  };

  const handleConvertProposalToObservation = (proposal: AiObservationProposal) => {
    if (!activeProject) return;
    const nextObs = ObservationEngine.addObservation(activeProject.observations, {
      category: proposal.category,
      title: proposal.title,
      description: proposal.description,
      confidence: 'incertaine',
      importedFrom: `ia_${selectedAiProvider}`,
    });
    const nextProj: ReagProject = {
      ...activeProject,
      observations: nextObs,
    };
    const finalProj = settings.autoAnalyzeOnImport
      ? { ...nextProj, analysis: GameAnalysisEngine.analyzeProject(nextProj) }
      : nextProj;

    commitProjectUpdate(finalProj, {
      action: 'Conversion proposition IA en observation',
      actor: 'ia_proposition',
      details: `Observation "${proposal.title}" ajoutée avec confiance "incertaine".`,
    });
  };

  const handleUpdateSettings = (next: ReagSettings) => {
    projectManager.saveSettings(next);
    setSettings(next);
  };

  const handleToggleSetting = (key: 'soundEnabled' | 'showRuntimeDebugVectors') => {
    handleUpdateSettings({
      ...settings,
      [key]: !settings[key],
    });
  };

  const currentNavLabel =
    NAV_ITEMS.find((item) => item.id === activeTab)?.label || 'Tableau de bord';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Sidebar bureau (10 sections REAG Studio) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-slate-200">
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            REAG Studio
          </span>
          <span className="text-[11px] font-mono text-slate-500">V2</span>
        </div>

        <nav
          className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
          aria-label="Navigation principale"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-700 truncate">
            {activeProject ? activeProject.name : 'Aucun projet'}
          </p>
          <p className="tabular-nums">
            {activeProject
              ? `${activeProject.sources.length} sources · ${activeProject.observations.length} obs.`
              : ''}
          </p>
        </div>
      </aside>

      {/* Menu mobile */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-full bg-white h-full border-r border-slate-200 flex flex-col z-50">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
              <span className="font-display text-lg font-bold text-slate-900">
                REAG Studio V2
              </span>
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Contenu principal */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-6 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Ouvrir le menu"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">
                REAG Studio
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-slate-700 truncate max-w-[160px] sm:max-w-[240px]">
                {activeProject?.name || 'Aucun projet'}
              </span>
              <span className="text-slate-300" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 truncate">{currentNavLabel}</h1>
            </div>
          </div>

          <div className="shrink-0">
            {activeTab !== 'preview' ? (
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Gamepad2 className="w-4 h-4" />
                Aperçu du jeu
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Hammer className="w-4 h-4" />
                Éditeur de projet
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              activeProject={activeProject}
              projectsCount={projects.length}
              servicesStatus={servicesStatus}
              servicesError={servicesError}
              selectedAiProvider={selectedAiProvider}
              lastTestResult={lastTestResult}
              isGenerating={isGenerating}
              onRefreshServices={() => void refreshServices()}
              onNavigate={(tab) => setActiveTab(tab as NavTab)}
              onLaunchPreview={() => void handleStartPreview(true)}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectsView
              projects={projects}
              activeProjectId={activeProject?.id || ''}
              onSelectProject={handleSelectProject}
              onCreateProject={(n, subj, desc) => handleCreateProject(n, subj, desc)}
              onRenameProject={handleRenameProject}
              onDuplicateProject={handleDuplicateProject}
              onDeleteProject={handleDeleteProject}
              onExportProject={(p) => projectManager.exportProjectJson(p)}
              onImportProject={handleImportProject}
              onResetSample={handleResetWorkspace}
            />
          )}

          {activeTab === 'new-project' && (
            <NewProjectView
              onCreateProject={(input) =>
                handleCreateProject(
                  input.name,
                  input.referenceSubject,
                  input.description,
                  {
                    dimension: input.dimension,
                    preferredAiProvider: input.preferredAiProvider,
                  }
                )
              }
            />
          )}

          {activeTab === 'creation' && activeProject && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-xs text-slate-600">
                  Étape 1 : Enregistrez vos sources documentaires ci-dessous, puis passez aux
                  observations et à l’analyse REAG Core (ou utilisez les propositions IA).
                </p>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ai-providers')}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Propositions IA
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('analysis')}
                    className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 cursor-pointer"
                  >
                    Passer aux observations &amp; analyse
                  </button>
                </div>
              </div>
              <SourcesView project={activeProject} onUpdateSources={handleUpdateSources} />
            </div>
          )}

          {activeTab === 'analysis' && activeProject && (
            <AnalysisView
              project={activeProject}
              onUpdateObservations={handleUpdateObservations}
              onRunAnalysis={handleRunAnalysis}
              onGoToGenerator={() => setActiveTab('editor')}
            />
          )}

          {activeTab === 'editor' && activeProject && (
            <GeneratorView
              project={activeProject}
              onCompileSpec={handleCompileSpec}
              onUpdateSpec={handleUpdateSpec}
              onGenerateGame={handleGenerateGame}
              onOpenPreview={() => setActiveTab('preview')}
            />
          )}

          {activeTab === 'preview' && activeProject && (
            <GamePreviewView
              project={activeProject}
              settings={settings}
              localHostAvailable={Boolean(servicesStatus?.localHost.running)}
              previewService={servicesStatus?.preview || null}
              previewBusy={previewBusy}
              onStartLocalPreview={() => void handleStartPreview(true)}
              onStopLocalPreview={() => void handleStopPreview()}
              onToggleSetting={handleToggleSetting}
              onGoToGenerator={() => setActiveTab('editor')}
            />
          )}

          {activeTab === 'ai-providers' && (
            <AiProvidersView
              project={activeProject}
              servicesStatus={servicesStatus}
              selectedProvider={selectedAiProvider}
              selectedOllamaModel={selectedOllamaModel}
              onChangeProvider={handleChangeAiProvider}
              onRefreshServices={() => void refreshServices()}
              onConvertProposalToObservation={handleConvertProposalToObservation}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onResetWorkspace={handleResetWorkspace}
            />
          )}

          {activeTab === 'services' && (
            <ServicesStatusView
              activeProject={activeProject}
              servicesStatus={servicesStatus}
              servicesError={servicesError}
              previewBusy={previewBusy}
              onRefreshServices={() => void refreshServices()}
              onStartPreview={() => void handleStartPreview(true)}
              onStopPreview={() => void handleStopPreview()}
            />
          )}
        </main>
      </div>
    </div>
  );
}

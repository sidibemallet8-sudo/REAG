import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Cpu,
  FlaskConical,
  FolderKanban,
  Gamepad2,
  Hammer,
  Menu,
  Settings,
  X,
} from 'lucide-react';
import { AnalysisView } from './components/AnalysisView';
import { GamePreviewView } from './components/GamePreviewView';
import { GeneratorView } from './components/GeneratorView';
import { ProjectsView } from './components/ProjectsView';
import { SettingsView } from './components/SettingsView';
import { SourcesView } from './components/SourcesView';
import { TestsView } from './components/TestsView';
import { GameAnalysisEngine } from './modules/analysisEngine';
import { GameGenerator } from './modules/gameGenerator';
import { ProjectManager } from './modules/projectManager';
import { SpecificationEngine } from './modules/specificationEngine';
import {
  DocumentarySource,
  GameObservation,
  ReagGameSpec,
  ReagProject,
  ReagSettings,
} from './types/reag';

type NavTab =
  | 'projects'
  | 'sources'
  | 'analysis'
  | 'generator'
  | 'preview'
  | 'tests'
  | 'settings';

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'projects', label: 'Projets', icon: FolderKanban },
  { id: 'sources', label: 'Sources', icon: BookOpen },
  { id: 'analysis', label: 'Analyse', icon: Cpu },
  { id: 'generator', label: 'Générateur', icon: Hammer },
  { id: 'preview', label: 'Aperçu du jeu', icon: Gamepad2 },
  { id: 'tests', label: 'Tests', icon: FlaskConical },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

const projectManager = new ProjectManager();

function hydrateInitialSample(projects: ReagProject[]): ReagProject[] {
  let changed = false;
  const hydrated = projects.map((p) => {
    if (p.id === 'proj_labyrinthe_eclats' && !p.generatedArtifact && p.observations.length >= 2) {
      changed = true;
      const analysis = GameAnalysisEngine.analyzeProject(p);
      const spec = SpecificationEngine.buildSpecification(p, analysis);
      const artifact = GameGenerator.generateGame(spec);
      return {
        ...p,
        analysis,
        specification: spec,
        generatedArtifact: artifact,
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
  const [activeTab, setActiveTab] = useState<NavTab>('projects');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || projects[0],
    [projects, activeProjectId]
  );

  const commitProjectUpdate = (updated: ReagProject) => {
    const nextList = projectManager.updateProject(updated);
    setProjects(nextList);
  };

  const handleSelectProject = (id: string) => {
    projectManager.setActiveProjectId(id);
    setActiveProjectId(id);
  };

  const handleCreateProject = (name: string, referenceSubject: string, description: string) => {
    const created = projectManager.createProject(name, referenceSubject, description);
    setProjects(projectManager.loadProjects());
    setActiveProjectId(created.id);
    setActiveTab('sources');
  };

  const handleDuplicateProject = (id: string) => {
    const cloned = projectManager.duplicateProject(id);
    if (cloned) {
      setProjects(projectManager.loadProjects());
      setActiveProjectId(cloned.id);
    }
  };

  const handleDeleteProject = (id: string) => {
    const remaining = projectManager.deleteProject(id);
    setProjects(remaining);
    setActiveProjectId(projectManager.getActiveProjectId(remaining));
  };

  const handleImportProject = (rawJson: string) => {
    const imported = projectManager.importProjectJson(rawJson);
    setProjects(projectManager.loadProjects());
    setActiveProjectId(imported.id);
  };

  const handleResetWorkspace = () => {
    const reset = hydrateInitialSample(projectManager.resetWorkspaceToSample());
    setProjects(reset);
    setActiveProjectId(reset[0].id);
    setActiveTab('projects');
  };

  const handleUpdateSources = (sources: DocumentarySource[]) => {
    if (!activeProject) return;
    let next: ReagProject = { ...activeProject, sources };
    if (settings.autoAnalyzeOnImport && next.observations.length > 0) {
      next = { ...next, analysis: GameAnalysisEngine.analyzeProject(next) };
    }
    commitProjectUpdate(next);
  };

  const handleUpdateObservations = (observations: GameObservation[]) => {
    if (!activeProject) return;
    let next: ReagProject = { ...activeProject, observations };
    if (settings.autoAnalyzeOnImport) {
      next = { ...next, analysis: GameAnalysisEngine.analyzeProject(next) };
    }
    commitProjectUpdate(next);
  };

  const handleRunAnalysis = () => {
    if (!activeProject) return;
    const analysis = GameAnalysisEngine.analyzeProject(activeProject);
    const specification =
      analysis.canReconstruct
        ? SpecificationEngine.buildSpecification(activeProject, analysis, activeProject.specification)
        : activeProject.specification;
    commitProjectUpdate({
      ...activeProject,
      analysis,
      specification,
    });
  };

  const handleCompileSpec = () => {
    if (!activeProject || !activeProject.analysis) return;
    const specification = SpecificationEngine.buildSpecification(
      activeProject,
      activeProject.analysis
    );
    commitProjectUpdate({
      ...activeProject,
      specification,
    });
  };

  const handleUpdateSpec = (specification: ReagGameSpec) => {
    if (!activeProject) return;
    commitProjectUpdate({
      ...activeProject,
      specification,
    });
  };

  const handleGenerateGame = () => {
    if (!activeProject || !activeProject.specification) return;
    const generatedArtifact = GameGenerator.generateGame(activeProject.specification);
    commitProjectUpdate({
      ...activeProject,
      generatedArtifact,
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

  const currentNavLabel = NAV_ITEMS.find((item) => item.id === activeTab)?.label || 'Projets';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Sidebar bureau */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-slate-200">
        <div className="h-16 px-6 flex items-center border-b border-slate-200">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            REAG V1
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Navigation principale">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
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
              <span className="font-display text-lg font-bold text-slate-900">REAG V1</span>
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
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
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">Atelier</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-slate-700 truncate max-w-[180px] sm:max-w-[260px]">
                {activeProject?.name || 'Aucun projet'}
              </span>
              <span className="text-slate-300" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 whitespace-nowrap">{currentNavLabel}</h1>
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
                onClick={() => setActiveTab('generator')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Hammer className="w-4 h-4" />
                Éditer la spécification
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'projects' && (
            <ProjectsView
              projects={projects}
              activeProjectId={activeProject?.id || ''}
              onSelectProject={handleSelectProject}
              onCreateProject={handleCreateProject}
              onDuplicateProject={handleDuplicateProject}
              onDeleteProject={handleDeleteProject}
              onExportProject={(p) => projectManager.exportProjectJson(p)}
              onImportProject={handleImportProject}
              onResetSample={handleResetWorkspace}
            />
          )}

          {activeTab === 'sources' && activeProject && (
            <SourcesView project={activeProject} onUpdateSources={handleUpdateSources} />
          )}

          {activeTab === 'analysis' && activeProject && (
            <AnalysisView
              project={activeProject}
              onUpdateObservations={handleUpdateObservations}
              onRunAnalysis={handleRunAnalysis}
              onGoToGenerator={() => setActiveTab('generator')}
            />
          )}

          {activeTab === 'generator' && activeProject && (
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
              onToggleSetting={handleToggleSetting}
              onGoToGenerator={() => setActiveTab('generator')}
            />
          )}

          {activeTab === 'tests' && <TestsView />}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onResetWorkspace={handleResetWorkspace}
            />
          )}
        </main>
      </div>
    </div>
  );
}

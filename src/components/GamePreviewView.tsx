import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Download,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  createRuntimeState,
  playRuntimeTone,
  renderRuntimeCanvas,
  stepRuntime,
} from '../modules/gameRuntime';
import { RuntimeInputController } from '../modules/inputController';
import { GameRuntimeState, InputVector, ReagProject, ReagSettings } from '../types/reag';
import { downloadTextFile, slugifyFilename } from '../utils/download';

interface GamePreviewViewProps {
  project: ReagProject;
  settings: ReagSettings;
  onToggleSetting: (key: 'soundEnabled' | 'showRuntimeDebugVectors') => void;
  onGoToGenerator: () => void;
}

const STATUS_TEXT: Record<GameRuntimeState['status'], string> = {
  PRE_GAME: 'Prêt à démarrer',
  PLAYING: 'En cours',
  PAUSED: 'En pause',
  VICTORY: 'Victoire',
  DEFEAT: 'Défaite',
};

export const GamePreviewView: React.FC<GamePreviewViewProps> = ({
  project,
  settings,
  onToggleSetting,
  onGoToGenerator,
}) => {
  const artifact = project.generatedArtifact;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputControllerRef = useRef<RuntimeInputController>(new RuntimeInputController());
  const stateRef = useRef<GameRuntimeState | null>(
    artifact ? createRuntimeState(artifact, false) : null
  );
  const [hudState, setHudState] = useState<GameRuntimeState | null>(stateRef.current);
  const soundEnabledRef = useRef(settings.soundEnabled);
  const debugVectorsRef = useRef(settings.showRuntimeDebugVectors);

  useEffect(() => {
    soundEnabledRef.current = settings.soundEnabled;
  }, [settings.soundEnabled]);

  useEffect(() => {
    debugVectorsRef.current = settings.showRuntimeDebugVectors;
  }, [settings.showRuntimeDebugVectors]);

  // Réinitialisation propre quand l'artefact change
  useEffect(() => {
    inputControllerRef.current.resetAll();
    if (!artifact) {
      stateRef.current = null;
      setHudState(null);
      return;
    }
    const fresh = createRuntimeState(artifact, false);
    stateRef.current = fresh;
    setHudState(fresh);
  }, [artifact]);

  const handleStartOrResume = useCallback(() => {
    if (!stateRef.current || !artifact) return;
    if (
      stateRef.current.status === 'VICTORY' ||
      stateRef.current.status === 'DEFEAT'
    ) {
      inputControllerRef.current.resetAll();
      const restarted = createRuntimeState(artifact, true);
      stateRef.current = restarted;
      setHudState(restarted);
      return;
    }
    const next: GameRuntimeState = {
      ...stateRef.current,
      status: stateRef.current.status === 'PLAYING' ? 'PAUSED' : 'PLAYING',
    };
    stateRef.current = next;
    setHudState(next);
  }, [artifact]);

  const handleRestart = useCallback(() => {
    if (!artifact) return;
    inputControllerRef.current.resetAll();
    const restarted = createRuntimeState(artifact, true);
    stateRef.current = restarted;
    setHudState(restarted);
  }, [artifact]);

  // Boucle de jeu HTML5 Canvas 60 FPS avec sous-pas temps synchronisés
  useEffect(() => {
    if (!artifact) return;
    let rafId = 0;
    let lastTs = 0;
    let hudSyncAcc = 0;

    const tick = (ts: number) => {
      if (!lastTs) lastTs = ts;
      const rawDt = Math.min(ts - lastTs, 250);
      lastTs = ts;

      if (stateRef.current) {
        const prevStatus = stateRef.current.status;
        const prevScore = stateRef.current.score;
        const prevLives = stateRef.current.player.lives;

        const nextState = stepRuntime(
          stateRef.current,
          inputControllerRef.current.getVector(),
          rawDt,
          {
            onCollect: () => playRuntimeTone('collect', soundEnabledRef.current),
            onDamage: () => playRuntimeTone('damage', soundEnabledRef.current),
            onVictory: () => playRuntimeTone('victory', soundEnabledRef.current),
            onDefeat: () => playRuntimeTone('defeat', soundEnabledRef.current),
          }
        );
        stateRef.current = nextState;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx) {
          renderRuntimeCanvas(ctx, nextState, debugVectorsRef.current);
        }

        hudSyncAcc += rawDt;
        const stateChanged =
          prevStatus !== nextState.status ||
          prevScore !== nextState.score ||
          prevLives !== nextState.player.lives;

        if (stateChanged || hudSyncAcc >= 90) {
          hudSyncAcc = 0;
          setHudState(nextState);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [artifact]);

  // Contrôles clavier (ZQSD, WASD, Flèches, Espace) + réinitialisation sur perte de focus
  useEffect(() => {
    if (!artifact) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleStartOrResume();
        return;
      }
      if (inputControllerRef.current.handleKeyDown(e.code)) {
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      inputControllerRef.current.handleKeyUp(e.code);
    };

    const onBlur = () => {
      inputControllerRef.current.resetAll();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        inputControllerRef.current.resetAll();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [artifact, handleStartOrResume]);

  const handleTouchDown = (
    dir: keyof InputVector,
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // Ignore pointer capture restriction
    }
    inputControllerRef.current.setDirection(dir, true);
  };

  const handleTouchRelease = (dir: keyof InputVector) => {
    inputControllerRef.current.setDirection(dir, false);
  };

  if (!artifact || !hudState) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
        <h3 className="text-lg font-semibold text-slate-900">
          Aucun jeu 2D généré pour ce projet
        </h3>
        <p className="mt-1.5 text-sm text-slate-600 max-w-lg mx-auto">
          Passez par l’onglet Générateur pour compiler la spécification JSON et produire
          l’artefact HTML5 Canvas jouable.
        </p>
        <button
          type="button"
          onClick={onGoToGenerator}
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
        >
          Aller au générateur
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <section className="xl:col-span-8 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        {/* HUD épuré au-dessus du canvas */}
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{artifact.spec.title}</h3>
            <p className="text-xs text-slate-500">
              État :{' '}
              <span
                className={`font-semibold ${
                  hudState.status === 'VICTORY'
                    ? 'text-emerald-700'
                    : hudState.status === 'DEFEAT'
                    ? 'text-rose-700'
                    : hudState.status === 'PLAYING'
                    ? 'text-blue-700'
                    : 'text-slate-700'
                }`}
              >
                {STATUS_TEXT[hudState.status]}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-5 text-sm text-slate-700 tabular-nums flex-wrap">
            <span>
              Score : <strong className="text-slate-900">{hudState.score}</strong>
            </span>
            <span>
              {artifact.spec.collectibles.label} :{' '}
              <strong className="text-slate-900">
                {hudState.collectedCount}/{hudState.totalCollectibles}
              </strong>
            </span>
            <span>
              Vies :{' '}
              <strong className="text-slate-900">
                {hudState.player.lives}/{hudState.player.maxLives}
              </strong>
            </span>
            {hudState.timeRemainingMs !== null && (
              <span>
                Temps :{' '}
                <strong className="text-slate-900">
                  {Math.ceil(hudState.timeRemainingMs / 1000)} s
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Scène HTML5 Canvas */}
        <div className="relative rounded-lg overflow-hidden border border-slate-300 bg-slate-950">
          <canvas
            ref={canvasRef}
            width={artifact.spec.arena.width}
            height={artifact.spec.arena.height}
            className="w-full h-auto block"
          />

          {hudState.status !== 'PLAYING' && (
            <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center p-6 text-center">
              <p className="text-xl font-semibold text-white">
                {hudState.status === 'VICTORY'
                  ? 'Objectif atteint — Victoire'
                  : hudState.status === 'DEFEAT'
                  ? 'Partie terminée — Défaite'
                  : hudState.status === 'PAUSED'
                  ? 'Simulation en pause'
                  : artifact.spec.title}
              </p>
              <p className="mt-1.5 text-sm text-slate-200 max-w-md tabular-nums">
                {hudState.status === 'VICTORY' || hudState.status === 'DEFEAT'
                  ? `Score final : ${hudState.score} pts · ${hudState.collectedCount}/${hudState.totalCollectibles} ${artifact.spec.collectibles.label.toLowerCase()} collecté(s).`
                  : `Collectez tous les ${artifact.spec.collectibles.label.toLowerCase()} en évitant les ${artifact.spec.hazards.label.toLowerCase()}.`}
              </p>
              <button
                type="button"
                onClick={
                  hudState.status === 'VICTORY' || hudState.status === 'DEFEAT'
                    ? handleRestart
                    : handleStartOrResume
                }
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4" />
                {hudState.status === 'VICTORY' || hudState.status === 'DEFEAT'
                  ? 'Rejouer'
                  : hudState.status === 'PAUSED'
                  ? 'Reprendre'
                  : 'Démarrer la partie'}
              </button>
            </div>
          )}
        </div>

        {/* Barre d'actions & Pavé tactile */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleStartOrResume}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {hudState.status === 'PLAYING' ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  {hudState.status === 'PAUSED' ? 'Reprendre' : 'Démarrer'}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleRestart}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Redémarrer
            </button>

            <button
              type="button"
              onClick={() => onToggleSetting('soundEnabled')}
              aria-label="Activer ou couper les effets sonores"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {settings.soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
              Audio
            </button>

            <button
              type="button"
              onClick={() => onToggleSetting('showRuntimeDebugVectors')}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                settings.showRuntimeDebugVectors
                  ? 'border-blue-600 bg-blue-50 text-blue-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Vecteurs collision
            </button>
          </div>

          {/* Pavé tactile responsive (>= 44px) */}
          {artifact.spec.rules.allowTouchControls && (
            <div
              className="grid grid-cols-3 gap-1.5 select-none"
              aria-label="Pavé directionnel tactile"
            >
              <div />
              <button
                type="button"
                aria-label="Monter"
                onPointerDown={(e) => handleTouchDown('up', e)}
                onPointerUp={() => handleTouchRelease('up')}
                onPointerCancel={() => handleTouchRelease('up')}
                onLostPointerCapture={() => handleTouchRelease('up')}
                onPointerLeave={() => handleTouchRelease('up')}
                className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-300 bg-slate-100 active:bg-blue-600 active:text-white touch-none cursor-pointer"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <div />
              <button
                type="button"
                aria-label="Aller à gauche"
                onPointerDown={(e) => handleTouchDown('left', e)}
                onPointerUp={() => handleTouchRelease('left')}
                onPointerCancel={() => handleTouchRelease('left')}
                onLostPointerCapture={() => handleTouchRelease('left')}
                onPointerLeave={() => handleTouchRelease('left')}
                className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-300 bg-slate-100 active:bg-blue-600 active:text-white touch-none cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Descendre"
                onPointerDown={(e) => handleTouchDown('down', e)}
                onPointerUp={() => handleTouchRelease('down')}
                onPointerCancel={() => handleTouchRelease('down')}
                onLostPointerCapture={() => handleTouchRelease('down')}
                onPointerLeave={() => handleTouchRelease('down')}
                className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-300 bg-slate-100 active:bg-blue-600 active:text-white touch-none cursor-pointer"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Aller à droite"
                onPointerDown={(e) => handleTouchDown('right', e)}
                onPointerUp={() => handleTouchRelease('right')}
                onPointerCancel={() => handleTouchRelease('right')}
                onLostPointerCapture={() => handleTouchRelease('right')}
                onPointerLeave={() => handleTouchRelease('right')}
                className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-300 bg-slate-100 active:bg-blue-600 active:text-white touch-none cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Panneau latéral : Commandes, Légende & Journal d'événements */}
      <aside className="xl:col-span-4 space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h4 className="text-sm font-semibold text-slate-900">Commandes et légende</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Clavier : Flèches directionnelles, ZQSD ou WASD pour se déplacer · Barre Espace pour
            démarrer ou mettre en pause.
          </p>
          <div className="pt-1 space-y-2 text-xs text-slate-700">
            <div className="flex items-center gap-2.5">
              <span
                className="w-3.5 h-3.5 rounded-full inline-block shrink-0"
                style={{ backgroundColor: artifact.spec.player.color }}
              />
              <span>Avatar joueur ({artifact.spec.player.speed} px/s)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span
                className="w-3.5 h-3.5 rotate-45 inline-block shrink-0"
                style={{ backgroundColor: artifact.spec.collectibles.color }}
              />
              <span>
                {artifact.spec.collectibles.label} (+{artifact.spec.collectibles.pointsPerItem}{' '}
                pts)
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span
                className="w-3.5 h-3.5 rounded-full inline-block shrink-0"
                style={{ backgroundColor: artifact.spec.hazards.color }}
              />
              <span>
                {artifact.spec.hazards.label} (-{artifact.spec.hazards.damage} vie au contact)
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span
                className="w-3.5 h-3.5 inline-block shrink-0"
                style={{ backgroundColor: artifact.spec.obstacles.color }}
              />
              <span>Obstacles rigides (glissement sans dégât)</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  `${slugifyFilename(artifact.spec.title)}-jeu.html`,
                  artifact.standaloneHtml,
                  'text/html'
                )
              }
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Télécharger le jeu HTML5 autonome
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h4 className="text-sm font-semibold text-slate-900">
              Journal d’événements en direct
            </h4>
          </div>
          <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
            {hudState.events.map((evt) => (
              <div key={evt.id} className="px-4 py-2.5 text-xs flex items-start gap-2.5">
                <span className="font-mono text-slate-400 tabular-nums shrink-0">
                  {(evt.timestampMs / 1000).toFixed(1)}s
                </span>
                <span
                  className={
                    evt.type === 'degat'
                      ? 'text-rose-700'
                      : evt.type === 'collecte'
                      ? 'text-amber-700'
                      : evt.type === 'fin'
                      ? 'text-slate-900 font-semibold'
                      : 'text-slate-600'
                  }
                >
                  {evt.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};

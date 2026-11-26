export type SourceKind =
  | 'manuel'
  | 'note_gameplay'
  | 'article_technique'
  | 'capture_regles'
  | 'fichier_importe';

export type SourceReliability = 'verifiee' | 'partielle' | 'hypothese';

export interface DocumentarySource {
  id: string;
  title: string;
  kind: SourceKind;
  reliability: SourceReliability;
  reference: string;
  excerpt: string;
  createdAt: string;
}

export type ObservationCategory =
  | 'deplacement'
  | 'collecte'
  | 'obstacle'
  | 'danger'
  | 'score'
  | 'victoire'
  | 'defaite'
  | 'controle'
  | 'physique';

export type ObservationConfidence = 'confirmee' | 'deduite' | 'incertaine';

export interface GameObservation {
  id: string;
  category: ObservationCategory;
  title: string;
  description: string;
  sourceId?: string;
  confidence: ObservationConfidence;
  parameters: Record<string, string | number | boolean>;
  importedFrom?: string;
  createdAt: string;
}

export interface ExtractedMechanic {
  id: string;
  category: ObservationCategory;
  name: string;
  ruleSummary: string;
  evidenceSourceIds: string[];
  evidenceObservationIds: string[];
  sourced: boolean;
  parameters: Record<string, string | number | boolean>;
}

export interface AnalysisReport {
  projectId: string;
  analyzedAt: string;
  canReconstruct: boolean;
  refusalReason?: string;
  detectedArchetype: 'arcade_arene_2d' | 'indetermine';
  extractedMechanics: ExtractedMechanic[];
  controlBindings: string[];
  gaps: string[];
  v1Limitations: string[];
  metrics: {
    sourceCount: number;
    observationCount: number;
    sourcedMechanicCount: number;
    totalMechanicCount: number;
    sourceTraceabilityRatio: number;
  };
}

export interface ReagGameSpec {
  specVersion: '1.0';
  projectId: string;
  title: string;
  subtitle: string;
  genre: 'arcade_2d_topdown';
  arena: {
    width: number;
    height: number;
    backgroundColor: string;
    gridColor: string;
    wallColor: string;
  };
  player: {
    radius: number;
    speed: number;
    initialLives: number;
    invulnerabilityMs: number;
    color: string;
  };
  collectibles: {
    label: string;
    count: number;
    pointsPerItem: number;
    radius: number;
    color: string;
  };
  obstacles: {
    count: number;
    minSize: number;
    maxSize: number;
    layoutSeed: number;
    color: string;
  };
  hazards: {
    label: string;
    count: number;
    speed: number;
    radius: number;
    damage: number;
    behavior: 'patrol_bounce' | 'chase_slow';
    color: string;
  };
  rules: {
    winCondition: 'collect_all' | 'target_score';
    targetScore: number;
    timeLimitSeconds: number | null;
    allowTouchControls: boolean;
  };
  traceabilitySummary: {
    sourceCount: number;
    observationCount: number;
    sourceTraceabilityRatio: number;
  };
}

export interface SpecValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RectObstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollectibleEntity {
  id: string;
  x: number;
  y: number;
  radius: number;
  points: number;
  collected: boolean;
}

export interface HazardEntity {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  damage: number;
  behavior: 'patrol_bounce' | 'chase_slow';
}

export interface GeneratedLevelLayout {
  playerSpawn: { x: number; y: number };
  obstacles: RectObstacle[];
  collectibles: CollectibleEntity[];
  hazards: HazardEntity[];
}

export interface GeneratedGameArtifact {
  id: string;
  generatedAt: string;
  checksum: string;
  spec: ReagGameSpec;
  layout: GeneratedLevelLayout;
  standaloneHtml: string;
}

export type GameStatus = 'PRE_GAME' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'DEFEAT';

export interface ParticleEffect {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifeMs: number;
  maxLifeMs: number;
  color: string;
  size: number;
}

export interface RuntimeLogEntry {
  id: string;
  timestampMs: number;
  type: 'info' | 'collecte' | 'collision' | 'degat' | 'fin';
  message: string;
}

export interface GameRuntimeState {
  status: GameStatus;
  elapsedMs: number;
  timeRemainingMs: number | null;
  score: number;
  collectedCount: number;
  totalCollectibles: number;
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    lives: number;
    maxLives: number;
    invulnerableRemainingMs: number;
    facingAngle: number;
  };
  obstacles: RectObstacle[];
  collectibles: CollectibleEntity[];
  hazards: HazardEntity[];
  particles: ParticleEffect[];
  events: RuntimeLogEntry[];
  spec: ReagGameSpec;
}

export interface InputVector {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface ReagProject {
  id: string;
  name: string;
  referenceSubject: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  sources: DocumentarySource[];
  observations: GameObservation[];
  analysis: AnalysisReport | null;
  specification: ReagGameSpec | null;
  generatedArtifact: GeneratedGameArtifact | null;
}

export interface ReagSettings {
  autoAnalyzeOnImport: boolean;
  soundEnabled: boolean;
  showRuntimeDebugVectors: boolean;
  storageNamespace: string;
}

export interface TestCaseResult {
  id: string;
  module: string;
  name: string;
  passed: boolean;
  durationMs: number;
  details: string;
  error?: string;
}

export interface CapabilityAuditItem {
  module: string;
  feature: string;
  status: 'implemente' | 'partiel' | 'non_implemente';
  note: string;
}

export interface TestSuiteResult {
  executedAt: string;
  total: number;
  passed: number;
  failed: number;
  totalDurationMs: number;
  cases: TestCaseResult[];
  capabilities: CapabilityAuditItem[];
}

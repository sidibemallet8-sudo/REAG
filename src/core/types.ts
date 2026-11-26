import {
  ObservationCategory,
  ObservationConfidence,
  ProjectHistoryEntry,
} from '../types/reag';

export type EpistemicKind =
  | 'fait_verifie'
  | 'observation'
  | 'hypothese'
  | 'deduction'
  | 'inconnu'
  | 'contradiction';

export interface KnowledgeItem {
  id: string;
  kind: EpistemicKind;
  category: ObservationCategory | 'general';
  statement: string;
  sourceIds: string[];
  observationIds: string[];
  confidence: ObservationConfidence;
  providerOrigin: 'local_source' | 'observation_utilisateur' | 'ia_proposition' | 'reag_core';
  parameters?: Record<string, string | number | boolean>;
}

export interface CoreDecisionRecord {
  id: string;
  category: ObservationCategory | 'architecture';
  decision: string;
  justification: string;
  basedOnKnowledgeIds: string[];
  confidence: ObservationConfidence;
}

export interface CoreEvaluationResult {
  evaluatedAt: string;
  knowledgeItems: KnowledgeItem[];
  countsByKind: Record<EpistemicKind, number>;
  evidenceCoverageRatio: number;
  invalidSourceIds: string[];
  preservedConflicts: KnowledgeItem[];
  unknowns: KnowledgeItem[];
  decisions: CoreDecisionRecord[];
  historyEntry: ProjectHistoryEntry;
}

export interface AiObservationProposal {
  category: ObservationCategory;
  title: string;
  description: string;
  parameters?: Record<string, string | number | boolean>;
  rationale: string;
}

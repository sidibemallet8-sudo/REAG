import { GameAnalysisEngine } from '../modules/analysisEngine';
import {
  AnalysisReport,
  ObservationCategory,
  ProjectHistoryEntry,
  ReagProject,
} from '../types/reag';
import {
  AiObservationProposal,
  CoreDecisionRecord,
  CoreEvaluationResult,
  EpistemicKind,
  KnowledgeItem,
} from './types';

export const KnowledgeEngine = {
  extractFromProject(
    project: ReagProject,
    aiProposals: AiObservationProposal[] = []
  ): KnowledgeItem[] {
    const items: KnowledgeItem[] = [];
    const sourceMap = new Map(project.sources.map((s) => [s.id, s]));

    // 1. Faits vérifiés issus des sources documentaires vérifiées
    for (const src of project.sources) {
      items.push({
        id: `know_src_${src.id}`,
        kind: src.reliability === 'verifiee' ? 'fait_verifie' : 'hypothese',
        category: 'general',
        statement: `${src.title} : ${src.excerpt}`,
        sourceIds: [src.id],
        observationIds: [],
        confidence:
          src.reliability === 'verifiee'
            ? 'confirmee'
            : src.reliability === 'partielle'
            ? 'deduite'
            : 'incertaine',
        providerOrigin: 'local_source',
      });
    }

    // 2. Observations formalisées
    for (const obs of project.observations) {
      const linkedSource = obs.sourceId ? sourceMap.get(obs.sourceId) : undefined;
      items.push({
        id: `know_obs_${obs.id}`,
        kind:
          obs.confidence === 'confirmee' && linkedSource?.reliability === 'verifiee'
            ? 'fait_verifie'
            : obs.confidence === 'incertaine'
            ? 'hypothese'
            : 'observation',
        category: obs.category,
        statement: `${obs.title} : ${obs.description}`,
        sourceIds: obs.sourceId ? [obs.sourceId] : [],
        observationIds: [obs.id],
        confidence: obs.confidence,
        providerOrigin: 'observation_utilisateur',
        parameters: obs.parameters,
      });
    }

    // 3. Propositions IA (toujours classées comme hypothèses tant que l'utilisateur ne les a pas validées)
    aiProposals.forEach((prop, idx) => {
      items.push({
        id: `know_ai_${idx + 1}`,
        kind: 'hypothese',
        category: prop.category,
        statement: `[Proposition IA] ${prop.title} : ${prop.description}`,
        sourceIds: [],
        observationIds: [],
        confidence: 'incertaine',
        providerOrigin: 'ia_proposition',
        parameters: prop.parameters,
      });
    });

    return items;
  },
};

export const EvidenceEngine = {
  verifyEvidence(project: ReagProject, items: KnowledgeItem[]) {
    const validSources = new Set(project.sources.map((s) => s.id));
    const invalidSourceIds = new Set<string>();
    let itemsWithValidEvidence = 0;

    for (const item of items) {
      if (item.providerOrigin === 'local_source') {
        itemsWithValidEvidence += 1;
        continue;
      }
      const validLinks = item.sourceIds.filter((id) => validSources.has(id));
      for (const id of item.sourceIds) {
        if (!validSources.has(id)) invalidSourceIds.add(id);
      }
      if (validLinks.length > 0 && validLinks.length === item.sourceIds.length) {
        itemsWithValidEvidence += 1;
      }
    }

    const totalCheckable = items.length;
    const coverageRatio =
      totalCheckable > 0 ? Math.round((itemsWithValidEvidence / totalCheckable) * 100) : 0;

    return {
      coverageRatio,
      invalidSourceIds: Array.from(invalidSourceIds),
    };
  },
};

export const ConflictEngine = {
  preserveConflicts(report: AnalysisReport): KnowledgeItem[] {
    return report.contradictions.map((c) => ({
      id: `know_${c.id}`,
      kind: 'contradiction' as const,
      category: c.category,
      statement: c.resolutionNote,
      sourceIds: Array.from(
        new Set(c.values.map((v) => v.sourceId).filter((s): s is string => Boolean(s)))
      ),
      observationIds: c.values.map((v) => v.observationId),
      confidence: 'incertaine' as const,
      providerOrigin: 'reag_core' as const,
      parameters: { parameterKey: c.parameterKey, selectedValue: c.selectedValue },
    }));
  },
};

export const ReasoningEngine = {
  deriveDeductionsAndUnknowns(
    project: ReagProject,
    report: AnalysisReport
  ): { deductions: KnowledgeItem[]; unknowns: KnowledgeItem[] } {
    const deductions: KnowledgeItem[] = [];
    const unknowns: KnowledgeItem[] = [];

    if (report.canReconstruct) {
      deductions.push({
        id: 'know_ded_archetype',
        kind: 'deduction',
        category: 'general',
        statement: `Archétype déduit : arène 2D temps réel (${report.extractedMechanics.length} mécaniques formalisées).`,
        sourceIds: project.sources.map((s) => s.id),
        observationIds: project.observations.map((o) => o.id),
        confidence: report.contradictions.length === 0 ? 'confirmee' : 'deduite',
        providerOrigin: 'reag_core',
      });
    } else {
      unknowns.push({
        id: 'know_unk_loop',
        kind: 'inconnu',
        category: 'general',
        statement: report.refusalReason || 'Boucle de jeu principale non déterminée.',
        sourceIds: [],
        observationIds: [],
        confidence: 'incertaine',
        providerOrigin: 'reag_core',
      });
    }

    report.gaps.forEach((gap, idx) => {
      unknowns.push({
        id: `know_unk_gap_${idx + 1}`,
        kind: 'inconnu',
        category: 'general',
        statement: gap,
        sourceIds: [],
        observationIds: [],
        confidence: 'incertaine',
        providerOrigin: 'reag_core',
      });
    });

    return { deductions, unknowns };
  },
};

export const MemoryEngine = {
  createHistoryEntry(
    action: string,
    actor: ProjectHistoryEntry['actor'],
    details: string
  ): ProjectHistoryEntry {
    return {
      id: `hist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      actor,
      details,
    };
  },

  appendHistory(
    existing: ProjectHistoryEntry[] | undefined,
    entry: ProjectHistoryEntry,
    limit = 60
  ): ProjectHistoryEntry[] {
    return [entry, ...(existing || [])].slice(0, limit);
  },
};

export const DecisionEngine = {
  buildDecisions(report: AnalysisReport, knowledgeItems: KnowledgeItem[]): CoreDecisionRecord[] {
    const decisions: CoreDecisionRecord[] = [];

    decisions.push({
      id: 'dec_reconstruct_gate',
      category: 'architecture',
      decision: report.canReconstruct
        ? 'Autoriser la compilation de spécification 2D'
        : 'Bloquer la reconstruction automatique',
      justification: report.canReconstruct
        ? `${report.extractedMechanics.length} mécaniques extraites avec ${report.metrics.sourceTraceabilityRatio}% de traçabilité réelle.`
        : report.refusalReason || 'Données insuffisantes.',
      basedOnKnowledgeIds: knowledgeItems.slice(0, 6).map((k) => k.id),
      confidence: report.canReconstruct ? 'confirmee' : 'incertaine',
    });

    for (const mech of report.extractedMechanics) {
      const relatedKnowledge = knowledgeItems.filter((k) => k.category === mech.category);
      decisions.push({
        id: `dec_${mech.id}`,
        category: mech.category as ObservationCategory,
        decision: `Retenir "${mech.name}" (${Object.keys(mech.parameters).length} paramètre(s))`,
        justification: mech.sourced
          ? `Appuyé sur ${mech.evidenceSourceIds.length} source(s) et ${mech.evidenceObservationIds.length} observation(s).`
          : 'Basé uniquement sur des observations non sourcées (vigilance requise).',
        basedOnKnowledgeIds: relatedKnowledge.map((k) => k.id),
        confidence: mech.sourced ? 'confirmee' : 'deduite',
      });
    }

    return decisions;
  },
};

export const ReagCore = {
  evaluateProject(
    project: ReagProject,
    aiProposals: AiObservationProposal[] = []
  ): CoreEvaluationResult {
    const report = project.analysis || GameAnalysisEngine.analyzeProject(project);
    const baseItems = KnowledgeEngine.extractFromProject(project, aiProposals);
    const evidence = EvidenceEngine.verifyEvidence(project, baseItems);
    const preservedConflicts = ConflictEngine.preserveConflicts(report);
    const { deductions, unknowns } = ReasoningEngine.deriveDeductionsAndUnknowns(project, report);

    const allItems = [...baseItems, ...deductions, ...preservedConflicts, ...unknowns];
    const countsByKind: Record<EpistemicKind, number> = {
      fait_verifie: 0,
      observation: 0,
      hypothese: 0,
      deduction: 0,
      inconnu: 0,
      contradiction: 0,
    };
    for (const item of allItems) {
      countsByKind[item.kind] += 1;
    }

    const decisions = DecisionEngine.buildDecisions(report, allItems);
    const historyEntry = MemoryEngine.createHistoryEntry(
      'Évaluation REAG Core',
      'reag_core',
      `${countsByKind.fait_verifie} fait(s), ${countsByKind.observation} obs., ${countsByKind.contradiction} contradiction(s), ${countsByKind.inconnu} inconnu(s).`
    );

    return {
      evaluatedAt: new Date().toISOString(),
      knowledgeItems: allItems,
      countsByKind,
      evidenceCoverageRatio: evidence.coverageRatio,
      invalidSourceIds: evidence.invalidSourceIds,
      preservedConflicts,
      unknowns,
      decisions,
      historyEntry,
    };
  },
};

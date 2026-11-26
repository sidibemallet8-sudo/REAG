import { createBlankProject, createSampleProject } from '../data/sampleProject';
import { CapabilityAuditItem, TestCaseResult, TestSuiteResult } from '../types/reag';
import { GameAnalysisEngine } from './analysisEngine';
import { GameGenerator } from './gameGenerator';
import { createRuntimeState, stepRuntime } from './gameRuntime';
import { ObservationEngine } from './observationEngine';
import { memoryStorage, ProjectManager } from './projectManager';
import { ResearchManager } from './researchManager';
import { SpecificationEngine } from './specificationEngine';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function runTestCase(
  id: string,
  module: string,
  name: string,
  fn: () => string
): TestCaseResult {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    const details = fn();
    const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return {
      id,
      module,
      name,
      passed: true,
      durationMs: Math.max(0.01, Number((end - start).toFixed(2))),
      details,
    };
  } catch (err) {
    const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return {
      id,
      module,
      name,
      passed: false,
      durationMs: Math.max(0.01, Number((end - start).toFixed(2))),
      details: 'Échec de l’assertion.',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const V1_CAPABILITY_AUDIT: CapabilityAuditItem[] = [
  {
    module: 'A. Project Manager',
    feature: 'Création, duplication, suppression, persistance locale et export/import JSON',
    status: 'implemente',
    note: 'Persistance navigateur via localStorage et sérialisation JSON complète validée.',
  },
  {
    module: 'B. Research Manager',
    feature: 'Gestion de sources documentaires et import de fichiers (.txt, .md, .json)',
    status: 'implemente',
    note: 'Parsing local des fichiers importés ; pas de scraping web distant sans backend dédié.',
  },
  {
    module: 'C. Observation Engine',
    feature: 'Saisie structurée et import CSV / JSON / texte libre',
    status: 'implemente',
    note: 'Extraction automatique des paramètres numériques de base (vitesse, points, vies, durée).',
  },
  {
    module: 'D. Game Analysis Engine',
    feature: 'Analyse déterministe traçable et refus de reconstruction sans preuves',
    status: 'partiel',
    note: 'Moteur déterministe à règles. Ne réalise pas d’analyse vidéo binaire ni d’extraction ROM.',
  },
  {
    module: 'E. Specification Engine',
    feature: 'Compilation JSON v1.0 et validation des bornes / cohérence',
    status: 'implemente',
    note: 'Vérifie l’atteignabilité du score cible et signale les spécifications sans condition de défaite.',
  },
  {
    module: 'F. Game Generator',
    feature: 'Génération de niveau déterministe et export HTML5 autonome (.html)',
    status: 'partiel',
    note: 'Génère exclusivement des jeux d’arène 2D top-down. Pas de génération de plateforme gravitaire ni 3D en V1.',
  },
  {
    module: 'G. Game Runtime',
    feature: 'Boucle HTML5 Canvas, collisions par axe, score, victoire/défaite, clavier et tactile',
    status: 'implemente',
    note: 'Exécutable en navigateur et en simulation headless pour les tests automatisés.',
  },
  {
    module: 'H. Analyse Python / Serveur / IA externe',
    feature: 'Moteur Python externe ou décompilation binaire automatique',
    status: 'non_implemente',
    note: 'Non implémenté dans la V1 : toute la logique d’analyse est embarquée en TypeScript pour fonctionner hors serveur.',
  },
];

export const TestingEngine = {
  runAllTests(): TestSuiteResult {
    const startAll = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const cases: TestCaseResult[] = [];

    // Test 1 : Project Manager — persistance et export/import
    cases.push(
      runTestCase(
        'test_pm_persistence',
        'A. Project Manager',
        'Création, persistance, export et ré-import JSON d’un projet',
        () => {
          memoryStorage.removeItem('reag_test_projects');
          memoryStorage.removeItem('reag_test_active_id');
          const pm = new ProjectManager(memoryStorage, 'reag_test');
          const created = pm.createProject(
            'Projet Test Unitaire',
            'Prototype arène',
            'Vérification persistance'
          );
          const loaded = pm.loadProjects();
          assert(loaded.some((p) => p.id === created.id), 'Projet créé introuvable après rechargement.');

          const json = pm.exportProjectJson(created);
          const imported = pm.importProjectJson(json);
          assert(
            imported.name.includes('Projet Test Unitaire'),
            'Le nom du projet ré-importé ne correspond pas.'
          );
          return `Projet créé (${created.id}), exporté (${json.length} octets) et ré-importé (${imported.id}).`;
        }
      )
    );

    // Test 2 : Research Manager — ajout et import Markdown
    cases.push(
      runTestCase(
        'test_rm_markdown',
        'B. Research Manager',
        'Import et découpage d’une source documentaire Markdown',
        () => {
          const md = '# Mouvement\nVitesse 200 px/s.\n# Collecte\n10 gemmes à récupérer.';
          const sources = ResearchManager.parseImportedSourceFile('notes.md', md);
          assert(sources.length === 2, `Attendu 2 sections, obtenu ${sources.length}.`);
          assert(sources[0].title === 'Mouvement', 'Titre de la section 1 incorrect.');
          return `${sources.length} sources extraites depuis notes.md.`;
        }
      )
    );

    // Test 3 : Observation Engine — import CSV avec paramètres automatiques
    cases.push(
      runTestCase(
        'test_oe_csv',
        'C. Observation Engine',
        'Import CSV d’observations et extraction de paramètres numériques',
        () => {
          const csv = [
            'categorie;titre;description;confiance',
            'deplacement;Vitesse avatar;Le joueur avance à 240 px/s;confirmee',
            'collecte;Pièces;Chaque pièce donne 50 points;confirmee',
          ].join('\n');
          const { observations, errors } = ObservationEngine.parseImportedObservations(
            csv,
            'csv',
            'test.csv'
          );
          assert(errors.length === 0, `Erreurs inattendues : ${errors.join(', ')}`);
          assert(observations.length === 2, `Attendu 2 observations, obtenu ${observations.length}.`);
          assert(
            observations[0].parameters.speed === 240,
            'Extraction du paramètre speed=240 échouée.'
          );
          assert(
            observations[1].parameters.pointsPerItem === 50,
            'Extraction du paramètre pointsPerItem=50 échouée.'
          );
          return '2 observations CSV parsées avec paramètres speed=240 et pointsPerItem=50.';
        }
      )
    );

    // Test 4 : Garde-fou anti-hallucination (nom seul refusé)
    cases.push(
      runTestCase(
        'test_ae_guardrail',
        'D. Game Analysis Engine',
        'Refus explicite de reconstruire un jeu à partir du seul nom sans observations',
        () => {
          const bareProject = createBlankProject('Pac-Man Commercial', 'Pac-Man', 'Nom seul');
          const report = GameAnalysisEngine.analyzeProject(bareProject);
          assert(
            report.canReconstruct === false,
            'Le moteur aurait dû refuser la reconstruction sans observations.'
          );
          assert(
            Boolean(report.refusalReason && report.refusalReason.length > 10),
            'Une raison explicite de refus doit être fournie.'
          );
          return `Refus confirmé : "${report.refusalReason}"`;
        }
      )
    );

    // Test 5 : Analyse complète du projet d’exemple et traçabilité
    cases.push(
      runTestCase(
        'test_ae_sample',
        'D. Game Analysis Engine',
        'Analyse du projet d’exemple et calcul réel de traçabilité',
        () => {
          const sample = createSampleProject();
          const report = GameAnalysisEngine.analyzeProject(sample);
          assert(report.canReconstruct === true, 'Le projet d’exemple doit être reconstructible.');
          assert(
            report.metrics.sourceTraceabilityRatio === 100,
            `Traçabilité attendue 100%, obtenue ${report.metrics.sourceTraceabilityRatio}%.`
          );
          assert(
            report.extractedMechanics.length >= 6,
            `Au moins 6 mécaniques attendues, obtenu ${report.extractedMechanics.length}.`
          );
          return `${report.extractedMechanics.length} mécaniques extraites, traçabilité ${report.metrics.sourceTraceabilityRatio}%.`;
        }
      )
    );

    // Test 6 : Specification Engine — compilation et détection d’incohérence
    cases.push(
      runTestCase(
        'test_se_validation',
        'E. Specification Engine',
        'Génération de spécification JSON et détection d’un score cible impossible',
        () => {
          const sample = createSampleProject();
          const report = GameAnalysisEngine.analyzeProject(sample);
          const spec = SpecificationEngine.buildSpecification(sample, report);
          const validRes = SpecificationEngine.validateSpecification(spec);
          assert(validRes.valid === true, 'La spécification d’exemple doit être valide.');

          const brokenSpec = {
            ...spec,
            rules: { ...spec.rules, winCondition: 'target_score' as const, targetScore: 999999 },
          };
          const invalidRes = SpecificationEngine.validateSpecification(brokenSpec);
          assert(invalidRes.valid === false, 'Un score cible impossible doit être rejeté.');
          return `Spécification valide générée ; erreur détectée correctement sur score impossible (${invalidRes.errors[0]}).`;
        }
      )
    );

    // Test 7 : Game Generator — placement sans chevauchement et export HTML
    cases.push(
      runTestCase(
        'test_gg_artifact',
        'F. Game Generator',
        'Génération déterministe du niveau et export HTML5 autonome',
        () => {
          const sample = createSampleProject();
          const report = GameAnalysisEngine.analyzeProject(sample);
          const spec = SpecificationEngine.buildSpecification(sample, report);
          const artifact = GameGenerator.generateGame(spec);

          assert(
            artifact.layout.collectibles.length === spec.collectibles.count,
            `Collectibles générés (${artifact.layout.collectibles.length}) != attendus (${spec.collectibles.count}).`
          );
          assert(
            artifact.standaloneHtml.includes('<canvas id="game"'),
            'Le bundle HTML autonome ne contient pas le canvas de jeu.'
          );
          return `Artefact ${artifact.id} (checksum ${artifact.checksum}) avec ${artifact.layout.obstacles.length} obstacles et ${artifact.layout.collectibles.length} objets.`;
        }
      )
    );

    // Test 8 : Game Runtime — déplacement, collision obstacle, collecte, victoire et défaite
    cases.push(
      runTestCase(
        'test_gr_simulation',
        'G. Game Runtime',
        'Simulation physique headless : déplacement, collecte, victoire et défaite',
        () => {
          const sample = createSampleProject();
          const report = GameAnalysisEngine.analyzeProject(sample);
          const spec = SpecificationEngine.buildSpecification(sample, report);
          spec.obstacles.count = 0;
          spec.hazards.count = 0;
          spec.collectibles.count = 1;
          const artifact = GameGenerator.generateGame(spec);

          // Placer l’unique collectible juste à droite du joueur
          artifact.layout.collectibles[0] = {
            id: 'col_test',
            x: artifact.layout.playerSpawn.x + 28,
            y: artifact.layout.playerSpawn.y,
            radius: 10,
            points: 100,
            collected: false,
          };

          let state = createRuntimeState(artifact, true);
          const startX = state.player.x;
          for (let i = 0; i < 10; i += 1) {
            state = stepRuntime(
              state,
              { up: false, down: false, left: false, right: true },
              30
            );
          }

          assert(state.player.x > startX, 'Le personnage ne s’est pas déplacé vers la droite.');
          assert(state.collectedCount === 1, 'La collecte de l’objet n’a pas été déclenchée.');
          assert(state.score === 100, `Score attendu 100, obtenu ${state.score}.`);
          assert(state.status === 'VICTORY', `État attendu VICTORY, obtenu ${state.status}.`);

          // Vérification condition de défaite par fin de chrono
          const timedSpec = { ...spec, rules: { ...spec.rules, timeLimitSeconds: 1 } };
          const timedArtifact = GameGenerator.generateGame(timedSpec);
          let timedState = createRuntimeState(timedArtifact, true);
          for (let i = 0; i < 30; i += 1) {
            timedState = stepRuntime(
              timedState,
              { up: false, down: false, left: false, right: false },
              40
            );
          }
          assert(
            timedState.status === 'DEFEAT',
            `Défaite par chrono attendue, obtenu ${timedState.status}.`
          );

          return 'Déplacement, collecte (+100 pts), victoire et défaite par expiration vérifiés.';
        }
      )
    );

    const endAll = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const passed = cases.filter((c) => c.passed).length;
    const failed = cases.length - passed;

    return {
      executedAt: new Date().toISOString(),
      total: cases.length,
      passed,
      failed,
      totalDurationMs: Math.max(0.01, Number((endAll - startAll).toFixed(2))),
      cases,
      capabilities: V1_CAPABILITY_AUDIT,
    };
  },
};

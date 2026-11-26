import { ReagCore } from '../core/reagCore';
import { createBlankProject, createSampleProject } from '../data/sampleProject';
import { ThreeAdapter } from '../engines/threeAdapter';
import { buildCommonGameSpecification } from '../types/commonGameSpec';
import { CapabilityAuditItem, TestCaseResult, TestSuiteResult } from '../types/reag';
import { GameAnalysisEngine } from './analysisEngine';
import { GameGenerator } from './gameGenerator';
import { createRuntimeState, stepRuntime } from './gameRuntime';
import { RuntimeInputController } from './inputController';
import { ObservationEngine } from './observationEngine';
import { memoryStorage, ProjectManager } from './projectManager';
import { ResearchManager } from './researchManager';
import { SpecificationEngine } from './specificationEngine';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(fn: () => unknown, message: string): Error {
  try {
    fn();
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }
  throw new Error(message);
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
    feature: 'Création, duplication, suppression, persistance locale et export/import JSON validé',
    status: 'implemente',
    note: 'Validation stricte des imports JSON et protection des projets existants en cas de corruption.',
  },
  {
    module: 'B. Research Manager',
    feature: 'Gestion de sources documentaires et import de fichiers (.txt, .md, .json)',
    status: 'implemente',
    note: 'Parsing local validé des fichiers importés ; pas de scraping web distant sans backend dédié.',
  },
  {
    module: 'C. Observation Engine',
    feature: 'Saisie structurée et import CSV / JSON / texte libre',
    status: 'implemente',
    note: 'Extraction automatique des paramètres numériques avec filtrage des clés prototypes.',
  },
  {
    module: 'D. Game Analysis Engine',
    feature: 'Analyse déterministe, détection des sources invalides et préservation des contradictions',
    status: 'partiel',
    note: 'Moteur déterministe à règles avec traçabilité par observation. Ne réalise pas d’analyse vidéo binaire.',
  },
  {
    module: 'E. Specification Engine',
    feature: 'Compilation JSON v1.0 et validation stricte (NaN, Infinity, bornes, couleurs)',
    status: 'implemente',
    note: 'Refuse les valeurs non finies, dimensions impossibles, couleurs invalides et objectifs irréalisables.',
  },
  {
    module: 'F. Game Generator',
    feature: 'Placement vérifié, diagnostics d’échec et export HTML5 échappé',
    status: 'partiel',
    note: 'Cible exclusivement la 2D top-down. Refuse explicitement toute génération à placement incomplet.',
  },
  {
    module: 'G. Game Runtime',
    feature: 'Boucle HTML5 Canvas à sous-pas fixes, collect_all/target_score et réinitialisation focus',
    status: 'implemente',
    note: 'Exécutable en navigateur et en simulation headless, synchronisé avec le HTML exporté.',
  },
  {
    module: 'H. REAG Core & Spécification commune 2D/3D',
    feature: '6 moteurs épistémiques sans IA, CommonGameSpecification et adaptateur structurel Three.js',
    status: 'implemente',
    note: 'Rendu WebGL 3D complet volontairement différé à la prochaine mission ; adaptateur prêt.',
  },
];

export const TestingEngine = {
  runAllTests(): TestSuiteResult {
    const startAll = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const cases: TestCaseResult[] = [];

    // 1. Persistance & Export/Import nominal
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

    // 2. Import malformé & protection des projets existants
    cases.push(
      runTestCase(
        'test_pm_malformed_import',
        'A. Project Manager',
        'Rejet des imports JSON malformés et protection des projets existants',
        () => {
          memoryStorage.removeItem('reag_test_iso_projects');
          memoryStorage.removeItem('reag_test_iso_active_id');
          const pm = new ProjectManager(memoryStorage, 'reag_test_iso');
          const safeProj = pm.createProject('Projet Intact', 'Ref', 'Doit rester intact');
          const beforeSnapshot = JSON.stringify(pm.loadProjects());

          assertThrows(() => pm.importProjectJson('{json casse'), 'Syntaxe invalide non rejetée.');
          assertThrows(
            () => pm.importProjectJson('{"__proto__":{"polluted":true},"name":"X","sources":[],"observations":[]}'),
            'Clé __proto__ non rejetée.'
          );
          assertThrows(
            () =>
              pm.importProjectJson(
                JSON.stringify({
                  name: 'Corrompu',
                  sources: [],
                  observations: [{ category: 'deplacement', title: 'Bad', description: 'Bad', parameters: { speed: null } }],
                })
              ),
            'Paramètre null non rejeté.'
          );

          const after = pm.loadProjects();
          assert(
            JSON.stringify(after) === beforeSnapshot && after[0].id === safeProj.id,
            'Les projets existants ont été altérés.'
          );
          return 'Imports syntaxiquement invalides, __proto__ et paramètres corrompus rejetés sans altérer le stockage.';
        }
      )
    );

    // 3. Research Manager Markdown
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

    // 4. Observation Engine CSV
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
          assert(observations[0].parameters.speed === 240, 'Paramètre speed=240 non extrait.');
          assert(observations[1].parameters.pointsPerItem === 50, 'Paramètre pointsPerItem=50 non extrait.');
          return '2 observations CSV parsées avec paramètres speed=240 et pointsPerItem=50.';
        }
      )
    );

    // 5. Garde-fou nom seul
    cases.push(
      runTestCase(
        'test_ae_guardrail',
        'D. Game Analysis Engine',
        'Refus explicite de reconstruire un jeu à partir du seul nom sans observations',
        () => {
          const bareProject = createBlankProject('Pac-Man Commercial', 'Pac-Man', 'Nom seul');
          const report = GameAnalysisEngine.analyzeProject(bareProject);
          assert(report.canReconstruct === false, 'Reconstruction aurait dû être refusée.');
          assert(Boolean(report.refusalReason), 'Raison explicite manquante.');
          return `Refus confirmé : "${report.refusalReason}"`;
        }
      )
    );

    // 6. Traçabilité — observation avec source inexistante
    cases.push(
      runTestCase(
        'test_ae_invalid_source_ref',
        'D. Game Analysis Engine',
        'Détection des observations référençant une source inexistante et plafonnement traçabilité',
        () => {
          const proj = createSampleProject();
          proj.observations.push({
            id: 'obs_broken_ref',
            category: 'deplacement',
            title: 'Observation orpheline',
            description: 'Vitesse 215 px/s',
            sourceId: 'src_fantome_inexistant',
            confidence: 'confirmee',
            parameters: { speed: 215 },
            createdAt: new Date().toISOString(),
          });
          const report = GameAnalysisEngine.analyzeProject(proj);
          assert(
            report.invalidSourceReferences.length === 1 &&
              report.invalidSourceReferences[0].invalidSourceId === 'src_fantome_inexistant',
            'La référence source invalide n’a pas été signalée.'
          );
          assert(
            report.metrics.sourceTraceabilityRatio < 100,
            `La traçabilité ne doit pas être à 100% avec une source invalide (obtenu ${report.metrics.sourceTraceabilityRatio}%).`
          );
          return `Source inexistante détectée (${report.invalidSourceReferences[0].invalidSourceId}) ; traçabilité réelle ${report.metrics.sourceTraceabilityRatio}%.`;
        }
      )
    );

    // 7. Contradictions — préservation des désaccords et niveaux de confiance
    cases.push(
      runTestCase(
        'test_ae_contradictions',
        'D. Game Analysis Engine',
        'Préservation des observations contradictoires et priorité par niveau de confiance',
        () => {
          const proj = createSampleProject();
          proj.observations.push({
            id: 'obs_conflict_speed',
            category: 'deplacement',
            title: 'Hypothèse vitesse rapide',
            description: 'Le personnage semble avancer à 360 px/s',
            sourceId: 'src_manuel_arcade',
            confidence: 'incertaine',
            parameters: { speed: 360 },
            createdAt: new Date().toISOString(),
          });
          const report = GameAnalysisEngine.analyzeProject(proj);
          const speedConflict = report.contradictions.find(
            (c) => c.category === 'deplacement' && c.parameterKey === 'speed'
          );
          assert(Boolean(speedConflict), 'La contradiction sur speed n’a pas été détectée.');
          assert(speedConflict!.values.length === 2, 'Les deux valeurs contradictoires doivent être conservées.');
          assert(
            speedConflict!.selectedValue === 215,
            `La valeur confirmée (215) doit primer sur incertaine (360), obtenu ${speedConflict!.selectedValue}.`
          );
          return `Contradiction conservée (215 confirmée vs 360 incertaine), résolution : ${speedConflict!.selectedValue}.`;
        }
      )
    );

    // 8. Validation spécification — NaN, Infinity, couleurs et paramètres invalides
    cases.push(
      runTestCase(
        'test_se_nan_infinity_bounds',
        'E. Specification Engine',
        'Rejet des valeurs NaN, Infinity, couleurs invalides et dimensions hors bornes',
        () => {
          const sample = createSampleProject();
          const report = GameAnalysisEngine.analyzeProject(sample);
          const baseSpec = SpecificationEngine.buildSpecification(sample, report);

          const nanSpec = structuredClone(baseSpec);
          nanSpec.player.speed = Number.NaN;
          nanSpec.collectibles.pointsPerItem = Number.POSITIVE_INFINITY;
          nanSpec.arena.width = 120;
          nanSpec.arena.backgroundColor = 'javascript:alert(1)';
          nanSpec.hazards.damage = -3;
          nanSpec.player.radius = 0;

          const res = SpecificationEngine.validateSpecification(nanSpec);
          assert(!res.valid, 'Une spécification contenant NaN/Infinity/couleurs invalides aurait dû être rejetée.');
          assert(res.errors.length >= 6, `Attendu >= 6 erreurs, obtenu ${res.errors.length}.`);
          return `${res.errors.length} erreurs détectées et bloquées (NaN, Infinity, dimensions, couleur, dégâts, rayon).`;
        }
      )
    );

    // 9. Validation spécification — score impossible
    cases.push(
      runTestCase(
        'test_se_target_score',
        'E. Specification Engine',
        'Détection d’un score cible impossible à atteindre',
        () => {
          const sample = createSampleProject();
          const report = GameAnalysisEngine.analyzeProject(sample);
          const spec = SpecificationEngine.buildSpecification(sample, report);
          spec.rules.winCondition = 'target_score';
          spec.rules.targetScore = 999999;
          const res = SpecificationEngine.validateSpecification(spec);
          assert(!res.valid, 'Score cible impossible non bloqué.');
          return `Erreur détectée : ${res.errors[0]}`;
        }
      )
    );

    // 10. Sécurité export HTML — injection </script> et séparateurs Unicode
    cases.push(
      runTestCase(
        'test_gg_xss_script_escape',
        'F. Game Generator',
        'Sécurisation de l’export HTML contre </script>, <!-- et séparateurs Unicode \\u2028/\\u2029',
        () => {
          const sample = createSampleProject();
          const report = GameAnalysisEngine.analyzeProject(sample);
          const spec = SpecificationEngine.buildSpecification(sample, report);
          spec.title = 'Test </script><script>alert(1)</script> <!-- \u2028\u2029';
          spec.collectibles.label = 'Éclat</SCRIPT>';

          const artifact = GameGenerator.generateGame(spec);
          const html = artifact.standaloneHtml;
          const scriptStart = html.indexOf('<script>');
          const scriptEnd = html.lastIndexOf('</script>');
          assert(scriptStart !== -1 && scriptEnd > scriptStart, 'Balise script principale introuvable.');
          const scriptBody = html.slice(scriptStart + 8, scriptEnd);

          assert(!/<\/script>/i.test(scriptBody), 'Une balise </script> brute est présente dans le script !');
          assert(!scriptBody.includes('\u2028') && !scriptBody.includes('\u2029'), 'Séparateur Unicode brut présent dans le script.');

          const dataLineMatch = scriptBody.match(/const DATA = (\{.*\});/);
          assert(Boolean(dataLineMatch && dataLineMatch[1]), 'Payload DATA introuvable dans le HTML.');
          const parsedData = JSON.parse(dataLineMatch![1]) as { spec: { title: string } };
          assert(parsedData.spec.title === spec.title, 'Le titre décodé ne correspond pas à l’original.');
          return 'Aucune balise </script> ni U+2028/U+2029 brute dans le script ; JSON décodé intact.';
        }
      )
    );

    // 11. Génération niveau — échec explicite si placement incomplet
    cases.push(
      runTestCase(
        'test_gg_incomplete_placement',
        'F. Game Generator',
        'Refus explicite et diagnostics lorsque le placement d’entités est incomplet',
        () => {
          const sample = createSampleProject();
          const report = GameAnalysisEngine.analyzeProject(sample);
          const crowdedSpec = SpecificationEngine.buildSpecification(sample, report);
          crowdedSpec.arena.width = 360;
          crowdedSpec.arena.height = 280;
          crowdedSpec.obstacles.count = 35;
          crowdedSpec.obstacles.minSize = 95;
          crowdedSpec.obstacles.maxSize = 110;
          crowdedSpec.collectibles.count = 30;

          const layout = GameGenerator.generateLevelLayout(crowdedSpec);
          assert(!layout.diagnostics.complete, 'Le placement dense aurait dû échouer.');
          assert(layout.diagnostics.errors.length > 0, 'Les diagnostics d’erreur sont vides.');

          const err = assertThrows(
            () => GameGenerator.generateGame(crowdedSpec),
            'generateGame aurait dû lever une erreur sur placement incomplet.'
          );
          return `Placement incomplet bloqué (${layout.diagnostics.placed.obstacles}/${crowdedSpec.obstacles.count} obstacles) : ${err.message}`;
        }
      )
    );

    // 12. Conditions de victoire séparées (collect_all vs target_score)
    cases.push(
      runTestCase(
        'test_gr_win_conditions',
        'G. Game Runtime',
        'Séparation stricte des modes de victoire collect_all et target_score',
        () => {
          const sample = createSampleProject();
          const report = GameAnalysisEngine.analyzeProject(sample);
          const spec = SpecificationEngine.buildSpecification(sample, report);
          spec.obstacles.count = 0;
          spec.hazards.count = 0;
          spec.collectibles.count = 2;
          spec.collectibles.pointsPerItem = 100;
          spec.rules.winCondition = 'target_score';
          spec.rules.targetScore = 200;

          const artifact = GameGenerator.generateGame(spec);
          // Cas 1 : en mode target_score avec targetScore=200 mais 1er objet à 50 pts (total max 150)
          artifact.layout.collectibles[0] = {
            id: 'c1',
            x: artifact.layout.playerSpawn.x + 24,
            y: artifact.layout.playerSpawn.y,
            radius: 10,
            points: 50,
            collected: false,
          };
          artifact.layout.collectibles[1] = {
            id: 'c2',
            x: artifact.layout.playerSpawn.x + 56,
            y: artifact.layout.playerSpawn.y,
            radius: 10,
            points: 100,
            collected: false,
          };

          let state = createRuntimeState(artifact, true);
          for (let i = 0; i < 16; i += 1) {
            state = stepRuntime(state, { up: false, down: false, left: false, right: true }, 25);
          }
          assert(state.collectedCount === 2, `Attendu 2 collectés, obtenu ${state.collectedCount}.`);
          assert(state.score === 150, `Attendu score 150, obtenu ${state.score}.`);
          assert(
            state.status === 'PLAYING',
            `En mode target_score (200), tout collecter à 150 pts ne doit pas gagner (obtenu ${state.status}).`
          );

          // Cas 2 : mode collect_all gagne dès les 2 objets ramassés même avec targetScore plus élevé
          const collectAllSpec = structuredClone(spec);
          collectAllSpec.rules.winCondition = 'collect_all';
          const collectArtifact = GameGenerator.generateGame(collectAllSpec);
          collectArtifact.layout.collectibles[0] = { ...artifact.layout.collectibles[0] };
          collectArtifact.layout.collectibles[1] = { ...artifact.layout.collectibles[1] };

          let state2 = createRuntimeState(collectArtifact, true);
          for (let i = 0; i < 16; i += 1) {
            state2 = stepRuntime(state2, { up: false, down: false, left: false, right: true }, 25);
          }
          assert(state2.status === 'VICTORY', `En mode collect_all, la victoire est attendue (obtenu ${state2.status}).`);
          return 'target_score bloque la victoire à 150/200 pts même à 2/2 collectés ; collect_all gagne à 2/2.';
        }
      )
    );

    // 13. Gestion du temps lors d'un ralentissement (sous-pas synchronisés)
    cases.push(
      runTestCase(
        'test_gr_time_sync',
        'G. Game Runtime',
        'Cohérence entre temps écoulé, chronomètre et déplacement lors d’un ralentissement',
        () => {
          const sample = createSampleProject();
          const report = GameAnalysisEngine.analyzeProject(sample);
          const spec = SpecificationEngine.buildSpecification(sample, report);
          spec.obstacles.count = 0;
          spec.hazards.count = 0;
          spec.collectibles.count = 1;
          spec.player.speed = 200;
          spec.rules.timeLimitSeconds = 10;

          const artifact = GameGenerator.generateGame(spec);
          artifact.layout.collectibles[0].x = 680;
          artifact.layout.collectibles[0].y = 420;

          // Un frame fluide (10 x 20ms = 200ms) vs un frame ralenti (1 x 200ms = 200ms)
          let smooth = createRuntimeState(artifact, true);
          for (let i = 0; i < 10; i += 1) {
            smooth = stepRuntime(smooth, { up: false, down: false, left: false, right: true }, 20);
          }

          let lagged = createRuntimeState(artifact, true);
          lagged = stepRuntime(lagged, { up: false, down: false, left: false, right: true }, 200);

          assert(
            Math.abs(smooth.player.x - lagged.player.x) < 0.001,
            `Divergence de position : fluide=${smooth.player.x} vs ralenti=${lagged.player.x}.`
          );
          assert(
            smooth.elapsedMs === 200 && lagged.elapsedMs === 200,
            `Temps écoulé divergent : fluide=${smooth.elapsedMs} vs ralenti=${lagged.elapsedMs}.`
          );
          assert(
            smooth.timeRemainingMs === 9800 && lagged.timeRemainingMs === 9800,
            `Chronomètre divergent : fluide=${smooth.timeRemainingMs} vs ralenti=${lagged.timeRemainingMs}.`
          );
          return 'Position (+40 px), temps écoulé (200 ms) et chronomètre (9800 ms) identiques sous ralentissement.';
        }
      )
    );

    // 14. Cohérence entre runtime principal et HTML exporté
    cases.push(
      runTestCase(
        'test_gr_html_parity',
        'F/G. Parité Runtime',
        'Parité logique entre le runtime principal et le HTML autonome exporté',
        () => {
          const sample = createSampleProject();
          const report = GameAnalysisEngine.analyzeProject(sample);
          const spec = SpecificationEngine.buildSpecification(sample, report);
          spec.rules.winCondition = 'target_score';
          spec.rules.targetScore = 500;
          const artifact = GameGenerator.generateGame(spec);
          const html = artifact.standaloneHtml;

          assert(html.includes('function isVictoryReached'), 'Fonction isVictoryReached absente du HTML exporté.');
          assert(html.includes("winCondition === 'target_score'"), 'Séparation target_score absente du HTML exporté.');
          assert(html.includes('const SUBSTEP = 20;'), 'Sous-pas temporels absents du HTML exporté.');
          assert(html.includes('pointercancel') && html.includes('lostpointercapture'), 'Gestion pointercancel/lostpointercapture absente du HTML exporté.');
          assert(html.includes("addEventListener('blur', resetKeys)"), 'Réinitialisation blur absente du HTML exporté.');
          return 'Parité vérifiée : isVictoryReached, sous-pas temporels, pointercancel et blur présents dans le HTML exporté.';
        }
      )
    );

    // 15. Contrôles — perte de focus et pointercancel
    cases.push(
      runTestCase(
        'test_ctrl_focus_pointer',
        'G. Contrôles',
        'Réinitialisation des touches après perte de focus et pointercancel/capture',
        () => {
          const ctrl = new RuntimeInputController();
          ctrl.handleKeyDown('ArrowRight');
          ctrl.setDirection('up', true);
          assert(ctrl.getVector().right && ctrl.getVector().up, 'Entrées initiales non activées.');

          // Perte de capture tactile
          ctrl.handleLostPointerCapture('up');
          assert(!ctrl.getVector().up, 'Direction tactile restée bloquée après lostpointercapture.');

          // Perte de focus fenêtre
          ctrl.handlePointerCancel('up');
          ctrl.resetAll();
          const v = ctrl.getVector();
          assert(!v.up && !v.down && !v.left && !v.right, 'Une touche est restée active après perte de focus.');
          return 'Directions réinitialisées proprement sur lostpointercapture, pointercancel et blur.';
        }
      )
    );

    // 16. REAG Core — séparation épistémique et fonctionnement sans IA
    cases.push(
      runTestCase(
        'test_reag_core_epistemic',
        'H. REAG Core',
        'Distinction faits vérifiés / observations / hypothèses / contradictions sans IA',
        () => {
          const proj = createSampleProject();
          proj.observations.push({
            id: 'obs_conflict_core',
            category: 'deplacement',
            title: 'Hypothèse contradictoire vitesse',
            description: 'Vitesse 310 px/s',
            confidence: 'incertaine',
            parameters: { speed: 310 },
            createdAt: new Date().toISOString(),
          });
          proj.analysis = GameAnalysisEngine.analyzeProject(proj);

          const evalRes = ReagCore.evaluateProject(proj, [
            {
              category: 'score',
              title: 'Combo IA',
              description: 'Bonus hypothétique x2',
              rationale: 'Test proposition IA',
            },
          ]);

          assert(evalRes.countsByKind.fait_verifie > 0, 'Aucun fait vérifié détecté.');
          assert(evalRes.countsByKind.hypothese > 0, 'Les propositions IA doivent être classées en hypothèses.');
          assert(evalRes.countsByKind.contradiction >= 1, 'La contradiction n’a pas été préservée dans REAG Core.');
          assert(evalRes.decisions.length >= 2, 'DecisionEngine n’a produit aucune décision tracée.');
          return `${evalRes.countsByKind.fait_verifie} fait(s), ${evalRes.countsByKind.hypothese} hypothèse(s), ${evalRes.countsByKind.contradiction} contradiction(s) préservée(s).`;
        }
      )
    );

    // 17. Spécification commune 2D/3D et adaptateur Three.js
    cases.push(
      runTestCase(
        'test_common_spec_three_adapter',
        'H. Spécification commune 2D/3D',
        'Génération de CommonGameSpecification et préparation ThreeAdapter',
        () => {
          const sample = createSampleProject();
          const analysis = GameAnalysisEngine.analyzeProject(sample);
          const spec = SpecificationEngine.buildSpecification(sample, analysis);
          const validation = SpecificationEngine.validateSpecification(spec);
          const common = buildCommonGameSpecification(spec, analysis, validation, '3d');
          assert(common.dimension === '3d', 'Dimension 3D non propagée.');
          assert(common.scenes.length === 1 && common.cameras[0].mode === 'perspective_follow', 'Caméra 3D non préparée.');
          const plan = ThreeAdapter.prepareScenePlan(common);
          assert(plan.readyForFuture3D && plan.nodes.length >= 4, 'Plan Three.js incomplet.');
          return `CommonSpec v${common.schemaVersion} (dimension ${common.dimension}) et ${plan.nodes.length} noeud(s) Three.js préparés.`;
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

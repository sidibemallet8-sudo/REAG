import { ReagProject } from '../types/reag';

export function createSampleProject(): ReagProject {
  const now = '2026-11-20T09:30:00.000Z';

  return {
    id: 'proj_labyrinthe_eclats',
    name: "Labyrinthe d'Éclats",
    referenceSubject: 'Archétype Arcade Collecte & Patrouille 2D (reconstitution originale)',
    description:
      "Projet de référence documenté démontrant la chaîne complète REAG : sources techniques, observations formalisées, analyse traçable et génération d'un jeu 2D original jouable.",
    createdAt: now,
    updatedAt: now,
    sources: [
      {
        id: 'src_manuel_arcade',
        title: 'Note de conception — Déplacement en arène fermée',
        kind: 'manuel',
        reliability: 'verifiee',
        reference: 'archive-interne://docs/arene-topdown-v1.md',
        excerpt:
          "L'avatar évolue sur un plan 2D orthogonal à vitesse constante (210 px/s) sans inertie excessive, avec glissement fluide le long des parois rigides.",
        createdAt: now,
      },
      {
        id: 'src_gameplay_collecte',
        title: "Session d'observation #04 — Économie de points et éclats",
        kind: 'note_gameplay',
        reliability: 'verifiee',
        reference: 'journal-tests://session-04-collecte',
        excerpt:
          'Chaque éclat énergétique ramassé rapporte 100 points. La récolte complète des 10 éclats présents sur la carte déclenche la victoire immédiate.',
        createdAt: now,
      },
      {
        id: 'src_article_patrouille',
        title: 'Analyse comportementale — Sentinelles autonomes',
        kind: 'article_technique',
        reliability: 'partielle',
        reference: 'https://notes-techniques.exemple.org/ia-patrouille-rebond',
        excerpt:
          'Les sentinelles circulent en ligne droite et rebondissent sur les bordures et blocs obstacles. Le contact retire 1 point de vie avec 1,2 s d’invulnérabilité.',
        createdAt: now,
      },
      {
        id: 'src_capture_ergonomie',
        title: 'Spécification ergonomie — Double entrée clavier & tactile',
        kind: 'capture_regles',
        reliability: 'verifiee',
        reference: 'ergonomie://web-mobile-input',
        excerpt:
          'Support simultané des touches directionnelles / ZQSD au clavier et d’un pavé directionnel virtuel sur écran tactile.',
        createdAt: now,
      },
    ],
    observations: [
      {
        id: 'obs_move',
        category: 'deplacement',
        title: 'Déplacement omnidirectionnel normalisé',
        description:
          'Le personnage se déplace en 8 directions à une vitesse de 215 px/s avec normalisation diagonale.',
        sourceId: 'src_manuel_arcade',
        confidence: 'confirmee',
        parameters: { speed: 215, radius: 14 },
        createdAt: now,
      },
      {
        id: 'obs_collect',
        category: 'collecte',
        title: 'Collecte de 10 éclats énergétiques',
        description:
          '10 éclats lumineux sont répartis dans les zones accessibles ; chaque éclat ramassé ajoute 100 points au score.',
        sourceId: 'src_gameplay_collecte',
        confidence: 'confirmee',
        parameters: { count: 10, pointsPerItem: 100, label: 'Éclats' },
        createdAt: now,
      },
      {
        id: 'obs_obstacles',
        category: 'obstacle',
        title: 'Cloisons internes orthogonales',
        description:
          '8 blocs rectangulaires forment des couloirs dans l’arène et bloquent le passage sans blesser le joueur.',
        sourceId: 'src_manuel_arcade',
        confidence: 'confirmee',
        parameters: { obstacleCount: 8, minSize: 48, maxSize: 108 },
        createdAt: now,
      },
      {
        id: 'obs_hazards',
        category: 'danger',
        title: '4 sentinelles à rebond',
        description:
          '4 sentinelles mobiles patrouillent à 125 px/s et rebondissent sur les murs. Un contact retire 1 vie et accorde 1200 ms d’invulnérabilité.',
        sourceId: 'src_article_patrouille',
        confidence: 'confirmee',
        parameters: {
          hazardCount: 4,
          hazardSpeed: 125,
          behavior: 'patrol_bounce',
          invulnerabilityMs: 1200,
          label: 'Sentinelles',
        },
        createdAt: now,
      },
      {
        id: 'obs_score',
        category: 'score',
        title: 'Compteur de score cumulatif',
        description: 'Le score démarre à 0 et s’incrémente immédiatement à chaque collecte.',
        sourceId: 'src_gameplay_collecte',
        confidence: 'confirmee',
        parameters: { pointsPerItem: 100 },
        createdAt: now,
      },
      {
        id: 'obs_victory',
        category: 'victoire',
        title: 'Victoire par collecte intégrale',
        description: 'La partie est gagnée dès que les 10 éclats sont collectés avant la fin du chrono (90 s).',
        sourceId: 'src_gameplay_collecte',
        confidence: 'confirmee',
        parameters: { winCondition: 'collect_all', timeLimitSeconds: 90 },
        createdAt: now,
      },
      {
        id: 'obs_defeat',
        category: 'defaite',
        title: 'Défaite par perte des 3 vies ou temps écoulé',
        description: 'Le joueur dispose de 3 vies initiales. À 0 vie ou lorsque le minuteur atteint 0 s, la partie est perdue.',
        sourceId: 'src_article_patrouille',
        confidence: 'confirmee',
        parameters: { initialLives: 3, timeLimitSeconds: 90 },
        createdAt: now,
      },
      {
        id: 'obs_controls',
        category: 'controle',
        title: 'Contrôles clavier ZQSD / Flèches + tactile',
        description: 'Commandes clavier ZQSD/WASD/Flèches et pavé tactile directionnel activé.',
        sourceId: 'src_capture_ergonomie',
        confidence: 'confirmee',
        parameters: { allowTouchControls: true },
        createdAt: now,
      },
    ],
    analysis: null,
    specification: null,
    generatedArtifact: null,
  };
}

export function createBlankProject(
  name: string,
  referenceSubject: string,
  description: string
): ReagProject {
  const now = new Date().toISOString();
  return {
    id: `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    referenceSubject: referenceSubject.trim(),
    description: description.trim(),
    createdAt: now,
    updatedAt: now,
    sources: [],
    observations: [],
    analysis: null,
    specification: null,
    generatedArtifact: null,
  };
}

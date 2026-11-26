# Architecture Technique — REAG V1

## Principes directeurs

- **Architecture modulaire pure TypeScript** : chaque module (`src/modules/*.ts`) possède une responsabilité unique et peut être exécuté aussi bien dans le navigateur que dans un environnement headless Node.js pour les tests automatisés.
- **Zéro hallucination** : le moteur d'analyse refuse explicitement la génération si moins de 2 observations exploitables sont fournies.
- **Traçabilité explicite** : chaque mécanique extraite conserve la liste exacte des `sourceId` et `observationId` qui la justifient.

## Cartographie des 8 modules

| Module | Fichier | Rôle principal |
| :--- | :--- | :--- |
| A. Project Manager | `src/modules/projectManager.ts` | Persistance `localStorage` (avec repli mémoire pour les tests), CRUD, import/export JSON |
| B. Research Manager | `src/modules/researchManager.ts` | Gestion des sources documentaires et import `.txt`, `.md`, `.json` |
| C. Observation Engine | `src/modules/observationEngine.ts` | Saisie structurée, import CSV/JSON/texte, extraction de paramètres numériques |
| D. Game Analysis Engine | `src/modules/analysisEngine.ts` | Extraction déterministe de mécaniques, contrôle anti-nom-seul, détection des lacunes |
| E. Specification Engine | `src/modules/specificationEngine.ts` | Compilation en `ReagGameSpec` JSON v1.0 et validation stricte des bornes |
| F. Game Generator | `src/modules/gameGenerator.ts` | Placement déterministe sans chevauchement (PRNG seedé), checksum FNV-1a, export HTML5 autonome |
| G. Game Runtime | `src/modules/gameRuntime.ts` | Moteur 2D HTML5 Canvas, glissement sur obstacles, collecte, dangers, victoire/défaite, Web Audio |
| H. Testing Engine | `src/modules/testingEngine.ts` | Suite d'assertions automatisées sur les modules A–G + audit honnête des limites V1 |

## Limites assumées de la V1

1. Cible unique : arène 2D vue de dessus (pas de plateforme gravitaire ni 3D).
2. Analyse déterministe locale : pas de backend Python ni de vision par ordinateur sur vidéo.
3. Rendu vectoriel/géométrique sur HTML5 Canvas : aucun actif propriétaire importé.

# REAG V1 — Reverse Engineering & Automated Game Reconstruction

Application web expérimentale de rétro-ingénierie documentaire, formalisation de mécaniques de jeu et reconstruction automatisée de jeux 2D HTML5 Canvas.

## Avertissement méthodologique

REAG V1 **ne prétend jamais** convertir ou reconstituer intégralement un jeu commercial à partir de son seul nom. Le système exige des sources documentaires et des observations explicites pour formaliser une spécification JSON vérifiable et générer un **jeu 2D original** jouable.

## Installation et exécution

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer le serveur de développement (port 3000)
npm run dev

# 3. Vérifier le typage TypeScript
npm run lint

# 4. Exécuter les tests automatisés en ligne de commande
npm test

# 5. Compiler le bundle de production
npm run build
```

## Parcours utilisateur

1. **Projets** : Créer un projet, dupliquer, exporter/importer au format JSON ou utiliser le projet d'exemple *Labyrinthe d'Éclats*.
2. **Sources** : Enregistrer ou importer (`.txt`, `.md`, `.json`) des notes documentaires, manuels et captures de règles.
3. **Analyse** : Saisir ou importer (CSV, JSON, texte) des observations de gameplay, puis exécuter le moteur d'analyse déterministe pour inspecter la traçabilité et les lacunes réelles.
4. **Générateur** : Compiler et ajuster la spécification JSON structurée, valider les règles, générer le niveau 2D et exporter le jeu autonome en `.html` ou `.json`.
5. **Aperçu du jeu** : Jouer au jeu 2D reconstruit (clavier ZQSD/WASD/Flèches + pavé tactile), observer le journal d'événements et redémarrer instantanément.
6. **Tests** : Exécuter la suite de tests automatisés sur les 8 modules et consulter l'audit honnête des capacités V1.
7. **Paramètres** : Gérer les préférences locales, l'audio synthétique, les vecteurs de collision et la documentation technique.

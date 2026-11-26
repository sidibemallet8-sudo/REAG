# REAG Windows — Empaquetage portable (`REAG.exe` & `REAG-Windows.zip`)

## 1. Architecture retenue pour Windows 10 (8 Go RAM)

| Option évaluée | Compatibilité ESM / `@google/genai` | Empreinte RAM | Verdict |
| :--- | :--- | :--- | :--- |
| **`pkg` / `@yao-pkg/pkg`** | Limites sur paquets ESM récents et chemins dynamiques | Moyenne | Non retenu |
| **Electron** | Lourd (~250 Mo + Chromium ~400 Mo RAM) | Élevée | Non retenu (Chrome déjà installé) |
| **Node 22 portable (`runtime/node.exe`) + Exécuteur natif `REAG.exe` (`csc.exe` `/target:winexe`)** | **100 % compatible** ESM, Express, `@google/genai`, TypeScript natif Node 22 | Légère (~70 Mo serveur) | **Solution retenue** |

## 2. Structure de la distribution `REAG-Windows/`

```text
REAG-Windows/
├── REAG.exe                  # Compilé sur Windows 10 sans fenêtre console (/target:winexe)
├── REAG-Start.cmd            # Lanceur batch de secours
├── README.txt                # Guide utilisateur en français
├── build-reag-exe.ps1        # Compile REAGLauncher.cs -> REAG.exe
├── prepare-windows-zip.ps1   # Récupère node.exe v22 win-x64, compile REAG.exe et génère REAG-Windows.zip
├── REAGLauncher.cs           # Wrapper Windows (icône tray, instance unique, arrêt propre)
├── runtime/
│   └── node.exe              # Binaire officiel Node.js v22 LTS Windows x64
├── resources/
│   ├── server.ts
│   ├── package.json
│   ├── dist/                 # Frontend REAG Studio compilé
│   ├── server/               # REAG Local Host + IA hybride + Preview Manager
│   ├── launcher/             # reag-launcher.ts + chromeFinder.ts
│   └── node_modules/         # Uniquement les paquets runtime (express, dotenv, @google/genai)
└── data/
    └── projects/             # Projets sauvegardés sur disque, reag.lock.json, launcher.log
```

## 3. Limite environnementale constatée (Linux vs Windows 10)

L'environnement de développement actuel tourne sous **Linux x64** sans compilateur Windows `.NET csc.exe` ni exécution native Win32. **Aucun binaire `REAG.exe` ni archive Windows testée sur Win32 n'est prétendu généré depuis Linux.**

## 4. Procédure exacte de génération et de validation sur Windows 10

1. Depuis la racine du dépôt (Linux ou Windows) :
   ```bash
   npm install
   npm run build
   npm run package:portable
   ```
2. Copier `dist-portable/REAG-Windows` sur un PC Windows 10, puis exécuter dans PowerShell :
   ```powershell
   cd .\REAG-Windows
   powershell -ExecutionPolicy Bypass -File .\prepare-windows-zip.ps1
   ```
   Ce script :
   - télécharge le binaire officiel `node.exe` (Node.js `v22.14.0` win-x64) dans `runtime\node.exe` ;
   - compile `REAGLauncher.cs` via `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` en `/target:winexe` (aucune fenêtre de terminal visible) ;
   - produit l'archive `REAG-Windows.zip` prête à distribuer.
3. Tester le parcours complet A → L sur Windows 10 :
   - Extraire `REAG-Windows.zip` dans un dossier neuf ;
   - Double-cliquer sur `REAG.exe` ;
   - Vérifier l'ouverture automatique de Chrome sur REAG Studio (`http://127.0.0.1:4173`) ;
   - Créer un projet, vérifier sa sauvegarde dans `data\projects\`, générer un jeu 2D, cliquer sur **Lancer**, vérifier l'ouverture du jeu sur un second onglet Chrome (`http://127.0.0.1:4174/`), arrêter l'aperçu, fermer REAG via l'icône de notification (ou *Arrêter REAG Local Host*), puis relancer `REAG.exe` et vérifier la récupération du projet depuis le disque.

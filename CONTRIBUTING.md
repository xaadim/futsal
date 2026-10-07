# Contribuer

Merci de contribuer à Futsal Aytré. Les changements sont intégrés dans la branche `develop`.

## Workflow

1. Récupérez les branches distantes et partez de `develop` :

   ```bash
   git fetch origin
   git switch develop
   git pull --ff-only origin develop
   ```

   Si `develop` n'est pas disponible après le `fetch`, vérifiez auprès d'un mainteneur avant de créer une branche de base.

2. Créez une branche dédiée à votre changement, par exemple `feat/rotation-equipes`, `fix/chrono` ou `docs/readme` :

   ```bash
   git switch -c feat/description-courte
   ```

3. Faites un changement ciblé et vérifiez-le dans un navigateur, sur ordinateur et mobile si l'interface est concernée. Le projet étant un site statique, aucun processus de compilation n'est nécessaire.

4. Vérifiez les modifications et ouvrez une pull request vers `develop` :

   ```bash
   git diff --check
   git push -u origin feat/description-courte
   ```

## Avant d'ouvrir une pull request

- Confirmez que le changement fonctionne et que les vues voisines ne sont pas affectées.
- Vérifiez les liens et les chemins des ressources ajoutées ou modifiées.
- Décrivez le comportement modifié et les vérifications effectuées dans la pull request.
- Pour un changement visuel, joignez une capture d'écran.

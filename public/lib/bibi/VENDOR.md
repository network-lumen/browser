# Bibi — code tiers copié dans ce dépôt

Lecteur EPUB, chargé par `src/internal/pages/IpfsPage.vue` pour afficher un livre
servi depuis IPFS. Ce dossier n'est pas du code Lumen.

| | |
|---|---|
| Projet | Bibi — EPUB Reader on your website |
| Auteur | Satoru Matsushima |
| Source | https://github.com/satorumurmur/bibi |
| Site | https://bibi.epub.link |
| Licence | MIT — https://github.com/satorumurmur/bibi/blob/master/LICENSE |
| Poids ici | 23 fichiers, ~2,3 Mo |

## Pourquoi ce fichier existe

Bibi est **copié**, pas installé : il n'apparaît dans aucun `package.json`, donc
`npm audit`, `npm outdated` et Dependabot ne le voient pas. Une faille publiée
sur ce projet ne remontera par aucun canal automatique — quelqu'un doit aller
regarder.

## Version

**Inconnue, et c'est le problème.** Les fichiers ne portent pas de numéro de
version : les bannières ne contiennent qu'un copyright, et le `version: "1.0.28"`
trouvable dans `resources/scripts/bibi.js` appartient à *sML*, la bibliothèque
utilitaire du même auteur incluse dans le bundle — pas à Bibi.

Pour identifier la version réellement embarquée, comparer
`resources/scripts/bibi.js` aux artefacts des releases du dépôt amont.

## Mettre à jour

1. Récupérer une release depuis le dépôt amont.
2. Remplacer le contenu de ce dossier, en gardant ce fichier.
3. Noter la version retenue ci-dessous, avec la date.
4. Vérifier le rendu d'un EPUB via `lumen://ipfs/<cid>` — Bibi lit son contenu
   depuis l'élément `#bibi-book-data` que `IpfsPage.vue` injecte, et ce contrat
   n'est pas garanti d'une version à l'autre (voir les commentaires autour de
   `IpfsPage.vue:498`).

## Historique

| Date | Version | Note |
|---|---|---|
| — | inconnue | État à la reprise de l'audit du 2026-08-11 |

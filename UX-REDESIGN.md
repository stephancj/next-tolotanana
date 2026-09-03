# Refonte UX/UI terrain

Ce document conserve les décisions, réalisations et résultats de la refonte globale de Tolotanana.

## Objectif

Créer une interface clinique sobre, rapide et fiable, adaptée :

- aux tablettes ;
- aux saisies rapides de dossiers ;
- aux interruptions fréquentes ;
- aux connexions instables ;
- à une utilisation en environnement lumineux ;
- aux exigences d’accessibilité WCAG AA.

## Direction retenue

- Interface clinique sobre et tactile.
- Surfaces plates et hiérarchie typographique forte.
- Contrôles principaux de 44 à 48 px minimum.
- Couleurs réservées aux états utiles : succès, attente, alerte et erreur.
- Pas de gradients décoratifs ni d’accumulation de cartes et d’ombres.
- Vocabulaire utilisateur plutôt que termes techniques de synchronisation.
- Dexie présenté comme la source utilisateur, sans séparation visible Local/Serveur.
- Aucun conflit médical résolu silencieusement.

Les règles détaillées du système visuel sont définies dans [`DESIGN.md`](./DESIGN.md).

## Réalisations

### Navigation

- Navigation principale ramenée aux cinq tâches cliniques essentielles.
- Administration, monitoring, guide et langue regroupés dans le menu « Plus ».
- Affichage permanent de l’édition active et de l’état de sauvegarde.

### Dashboard

- Recentrage sur les exceptions et les actions immédiates.
- Mise en avant des patients non planifiés, pré-opérations incomplètes, dossiers incomplets et conflits.
- Vue synthétique du flux de la journée et du planning hebdomadaire.

### Liste des patients

- Vue unique fondée sur les données locales Dexie.
- Suppression de la distinction technique Local/Serveur.
- Recherche rapide avec autofocus, filtres et export CSV.
- Lignes responsives et actions tactiles.
- Suppression protégée par une confirmation accessible.

### Formulaire patient

- Navigation par sections avec sommaire persistant.
- Indication explicite des modifications non enregistrées.
- Barre de sauvegarde persistante.
- Raccourci `Ctrl/⌘ + S`.
- Validation minimale du nom.
- Champs et constantes vitales harmonisés avec le design system.
- Contrôles suffisamment grands pour une saisie sur tablette.

### Planning

- Mode jour ciblé pour les petits écrans et tablettes.
- Accès distinct aux patients non planifiés.
- Auto-planification protégée par un dialogue sémantique.
- Notifications de réussite et d’échec lors des sauvegardes.
- Colonnes adaptées à la largeur disponible sur mobile.

### Opération et workflow

- Surfaces simplifiées et plus sobres.
- Actions principales maintenues visibles.
- Notifications non bloquantes.
- Suppression des ombres décoratives dans le parcours d’opération.

### Feedback et accessibilité

- Suppression complète des `alert()` et `window.confirm()` natifs.
- Ajout d’un `FeedbackProvider` global.
- Toasts accessibles pour les succès, avertissements et erreurs.
- Dialogues de confirmation sémantiques.
- Fermeture avec la touche Échap sur les modales principales.
- Focus initial amélioré.
- Styles de focus visibles.
- Respect de `prefers-reduced-motion`.
- Police Geist appliquée globalement.
- Correction de l’affichage des valeurs numériques égales à zéro.

### Guide et monitoring

- Guide rendu recherchable.
- Vocabulaire du monitoring simplifié : « Version serveur », « À récupérer », « Envois reçus ».
- États de chargement plus explicites.

## Résultat de l’évaluation

| Heuristique | Avant | Après |
|---|---:|---:|
| Visibilité de l’état du système | 3/4 | 4/4 |
| Correspondance avec le monde réel | 3/4 | 3/4 |
| Contrôle et liberté | 2/4 | 3/4 |
| Cohérence et standards | 2/4 | 3/4 |
| Prévention des erreurs | 2/4 | 3/4 |
| Reconnaissance plutôt que mémorisation | 3/4 | 3/4 |
| Flexibilité et efficacité | 2/4 | 4/4 |
| Design esthétique et minimaliste | 2/4 | 3/4 |
| Diagnostic et récupération d’erreur | 2/4 | 3/4 |
| Aide et documentation | 3/4 | 3/4 |
| **Total** | **24/40** | **32/40** |

Progression obtenue : **+8 points**.

## Validation technique

- `npm run lint` : réussi.
- `npm run build` : réussi.
- `git diff --check` : réussi.
- Aucun `alert()` ou `window.confirm()` restant dans les composants React.

## Améliorations futures

1. Convertir davantage les écrans Opération et Workflow en timeline clinique sobre.
2. Présenter les conflits sous forme de pile verticale sur les très petits écrans.
3. Ajouter un piège de focus complet dans tous les dialogues.
4. Étudier un mode « saisie minimale puis compléter » pour les accueils massifs.
5. Ajouter une action « Réessayer » directement dans les notifications réseau.

## Rapports associés

- Audit initial : `.impeccable/critique/2026-07-29T21-36-33Z__app.md`
- Audit après refonte : `.impeccable/critique/2026-07-29T21-52-56Z__app.md`

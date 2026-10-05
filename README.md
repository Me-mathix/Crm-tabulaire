# CRM – Vue contacts

## Démarrage

Prérequis : Docker et Docker Compose.

```bash
cp .env.example .env   # optionnel, des valeurs par défaut existent
docker compose up      # premier lancement : quelques minutes (npm install)
npm run seed           # dans un autre terminal : 6 colonnes + 500 contacts fictifs
```

- Front (Vite) : http://localhost:5173
- API (NestJS) : http://localhost:3000/api — santé : `/api/health`
- PostgreSQL : `localhost:5432`, utilisateur / mot de passe / base `crm`

Ordre de démarrage : `db` → `api` (installe les dépendances, applique les migrations) → `web`.

**Seed** : `npm run seed` réinitialise la base (supprime colonnes et contacts existants).
Pour un autre volume : `npm run seed -- 5000`. Les données sont reproductibles (graine fixe)
et passent par la même validation que l'API.

## Structure

```
packages/shared/   types de colonnes, validation, filtres, schémas Zod du contrat API
apps/api/          NestJS + PostgreSQL (pg)
apps/web/          React + Vite + TypeScript (CSS Modules)
```

Le paquet `shared` est la source unique des règles par type : l'API l'utilise pour valider,
le front pour afficher, éditer et pré-valider. Un « nombre » ou un « téléphone » se comporte
donc exactement de la même façon des deux côtés.

## Interface

Une grille unique, pilotable à la souris comme au clavier.

| Action | Souris | Clavier |
|---|---|---|
| Sélectionner une cellule | clic | flèches, Début / Fin, Page préc. / suiv. |
| Modifier | double-clic | Entrée, F2, ou commencer à taper |
| Valider | clic ailleurs | Entrée (descend), Tab (va à droite), Maj+Tab |
| Annuler la saisie | — | Échap |
| Vider une cellule | — | Suppr ou Retour arrière |
| Trier | clic sur le titre (croissant → décroissant → aucun) | — |
| Menu de colonne | bouton ⋯ au survol du titre | — |
| Réorganiser les colonnes | glisser un titre, ou menu « Déplacer » | — |
| Redimensionner | glisser le bord droit du titre | — |
| Ajouter une colonne | bouton + en fin d'en-tête | — |
| Supprimer un contact | × au survol du numéro de ligne | — |

- **Chargement progressif** : 50 contacts par page ; la page suivante est demandée quand il
  reste moins de 20 lignes chargées sous l'écran. Seules les lignes visibles sont rendues
  (virtualisation), la grille reste fluide avec des milliers de contacts.
- **Cohérence par type** : affichage, éditeur, validation, tri et filtres viennent tous du
  paquet `shared`. Une saisie invalide est signalée sous la cellule avant tout envoi ; si
  l'API refuse malgré tout, la valeur précédente est restaurée et la cellule passe en rouge
  avec le message du serveur.
- **Enregistrement immédiat** : chaque cellule validée est envoyée seule (`PATCH` partiel),
  affichée tout de suite et annulée en cas d'échec.
- **Tri et filtres dans l'URL** : ils survivent au rechargement et se partagent par lien.
- Une ligne modifiée reste à sa place même si elle ne correspond plus au tri ou aux filtres,
  jusqu'au prochain rechargement de la liste : la grille ne bouge pas sous le curseur.

## Modèle de données

- `fields` : définition des colonnes (`label`, `type`, `position`, `width`). Nom unique,
  insensible à la casse.
- `contacts` : `data jsonb` = `{ "<field id>": valeur }`. Une cellule vide = clé absente.

| Type      | Stockage           | Affichage          | Tri SQL                                  |
|-----------|--------------------|--------------------|------------------------------------------|
| texte     | chaîne             | brut               | alphabétique, sans casse (collation ICU) |
| nombre    | nombre JSON        | `1 234,5`          | `::numeric`                              |
| date      | `YYYY-MM-DD`       | `05/10/2026`       | `::date`                                 |
| téléphone | E.164 `+336…`      | `06 12 34 56 78`   | forme E.164                              |

Les cellules vides sont toujours en fin de liste, quel que soit le sens du tri.
Le type d'une colonne n'est pas modifiable après création (évite toute conversion de données).

## Contrat API (`/api`)

| Méthode | Route            | Corps / paramètres                                   |
|---------|------------------|------------------------------------------------------|
| GET     | `/fields`        | → colonnes ordonnées                                 |
| POST    | `/fields`        | `{ label, type }`                                    |
| PATCH   | `/fields/:id`    | `{ label?, width? }`                                 |
| PUT     | `/fields/order`  | `{ ids }` : toutes les colonnes, dans le nouvel ordre |
| DELETE  | `/fields/:id`    | supprime aussi les valeurs de la colonne             |
| GET     | `/contacts`      | `limit`, `offset`, `sort=<fieldId>:asc\|desc`, `filters=<JSON>` → `{ items, total, limit, offset }` |
| POST    | `/contacts`      | `{ values? }`                                        |
| PATCH   | `/contacts/:id`  | `{ values }` partiel ; une valeur vide vide la cellule |
| DELETE  | `/contacts/:id`  |                                                      |

`filters` est un tableau de `{ fieldId, operator, value? }` combinés en ET.
Opérateurs disponibles par type :

- texte : contient, est égal à, n'est pas égal à, est vide, n'est pas vide
- nombre : =, ≠, <, ≤, >, ≥, entre, est vide, n'est pas vide
- date : le, avant le, après le, entre, est vide, n'est pas vide
- téléphone : contient (sur les chiffres : « 06 12 » trouve `+33612…`), est vide, n'est pas vide

Le tri et les filtres sont exécutés en SQL : ils portent sur toutes les données, pas
seulement sur les lignes chargées. Les erreurs de validation renvoient un 400 avec
`fieldErrors` (par colonne) ou `errors`.

## Choix techniques

- **Pagination `limit` / `offset`** avec un ordre toujours stable (départage par date de
  création puis id). Une pagination par curseur serait complexe avec un tri sur n'importe
  quelle colonne JSONB, pour un gain nul à cette échelle.
- **`pg` + SQL paramétré** plutôt qu'un ORM : les requêtes sur JSONB (casts par type,
  `?`, `->>`) sont plus lisibles écrites directement. Le constructeur de requêtes
  (`contacts.query.ts`) est une fonction pure, testée unitairement.
- **Migrations SQL** appliquées au démarrage de l'API, protégées par un verrou.
- **Grille écrite à la main** (aucune grille toute faite) : seule la virtualisation des
  lignes est déléguée à `@tanstack/react-virtual`.
- **Chargement des données** : un hook dédié (`useContacts`) plutôt qu'une bibliothèque de
  cache. La pagination infinie avec ajouts, suppressions et modifications locales y tient en
  un reducer testé, qui ajuste l'offset pour ne jamais sauter ni dupliquer de ligne.
- **Glisser-déposer natif** du navigateur pour réordonner les titres : une seule rangée
  d'éléments, une bibliothèque n'apportait presque rien. Le menu de colonne offre une
  alternative au clavier.
- **Cellule active repérée par identifiants** (contact, colonne) et non par position : elle
  reste la même quand une ligne est ajoutée en haut de la liste.

## Tests

```bash
docker compose exec api npm test
```

Tests unitaires (Vitest) sur le code sans effets de bord :

- `packages/shared` : validation et format par type, filtres, schémas du contrat API
- `apps/api` : génération du SQL (tri, filtres, pagination), générateur du seed
- `apps/web` : navigation clavier, réordonnancement des colonnes, état de la liste paginée

## Hors périmètre (volontairement)

Authentification, temps réel, formules, sélection multiple / copier-coller, import/export
CSV, undo/redo, responsive mobile avancé, déploiement.

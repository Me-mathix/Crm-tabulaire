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

**Seed** : `npm run seed` réinitialise la base (⚠ supprime colonnes et contacts existants).
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

## Tests

```bash
docker compose exec api npm test -w @crm/shared -w api
```

## Hors périmètre (volontairement)

Authentification, temps réel, formules, sélection multiple / copier-coller, import/export
CSV, undo/redo, responsive mobile avancé, déploiement.

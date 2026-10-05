# CRM – Vue contacts

## Démarrage

Prérequis : Docker et Docker Compose.

```bash
cp .env.example .env   # optionnel, des valeurs par défaut existent
docker compose up
```

- Front (Vite) : http://localhost:5173
- PostgreSQL : `localhost:5432`, utilisateur / mot de passe / base `crm`

Le front attend que PostgreSQL soit prêt (healthcheck `pg_isready`) avant de démarrer.

Pour lancer uniquement la base : `docker compose up -d db`.

## Structure

```
apps/
  web/        React + Vite + TypeScript (CSS Modules)
  api/        NestJS (à venir)
packages/
  shared/     types de champs et schémas partagés (à venir)
```

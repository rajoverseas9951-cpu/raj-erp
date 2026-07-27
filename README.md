# RAJ ERP

RAJ ERP is a runnable customer and vehicle operations system. It provides a versioned Laravel 12 API secured by Sanctum, a Next.js 15 dashboard, PostgreSQL persistence, Redis caching/queues, and production-oriented containers.

## Modules

- **Customer CRM:** customer profiles, filtering, bulk assignment/deletion, exports, and activity timelines.
- **Vehicle Master:** vehicle identity, registration details, ownership, status, and search.

## Prerequisites

For Docker development, install Docker Engine with Compose v2. For local development, install PHP 8.2+, Composer 2, PostgreSQL 16+, Redis 7+, and Node.js 20+ with npm.

## Docker installation

```bash
cp .env.example .env
# Generate an application key locally, or with a temporary PHP/Laravel environment:
cd backend && cp .env.example .env && composer install
php artisan key:generate --show
# Copy the displayed key to ../.env, then return to the repository root.
docker compose build
docker compose up -d
# Create the initial administrator (safe to run repeatedly):
docker compose exec backend php artisan db:seed --force
```

The dashboard is at `http://localhost:3000`, the API at `http://localhost:8000/api/v1`, and health status at `http://localhost:8000/up`. Initial development credentials are `admin@raj-erp.local` / `ChangeMe123!`; change them immediately outside local development.

Useful commands:

```bash
docker compose ps
docker compose logs -f backend frontend queue
docker compose exec backend php artisan migrate:status
docker compose exec backend php artisan test
docker compose down
docker compose down -v # also deletes database and Redis data
```

## Local backend development

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
# Create the PostgreSQL database/user matching .env first.
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8000
# In a second terminal:
php artisan queue:work
```

Set `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` in `backend/.env`. PostgreSQL is the default connection. Set `CACHE_STORE=array`, `SESSION_DRIVER=file`, and `QUEUE_CONNECTION=sync` only for a minimal local environment without Redis.

## Local frontend development

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

`NEXT_PUBLIC_API_URL` must be the browser-accessible Laravel origin (normally `http://localhost:8000`). Authentication uses a Sanctum bearer token stored by the web client. Laravel CORS restricts credentialed requests to `FRONTEND_URL`.

## API

All endpoints are under `/api/v1`. Obtain a token with `POST /api/v1/auth/login`, send it as `Authorization: Bearer <token>`, and use `/auth/me` or `/auth/logout` to inspect/end the session. Customer routes are `/customers`; vehicle routes are `/vehicles`.

## Production deployment

1. Use unique PostgreSQL credentials and a strong `APP_KEY`; never deploy the example secrets.
2. Set public HTTPS values for `APP_URL`, `FRONTEND_URL`, and `NEXT_PUBLIC_API_URL` before building the frontend.
3. Put the exposed services behind a TLS reverse proxy/load balancer. Do not publish PostgreSQL or Redis.
4. Build immutable images with `docker compose build --pull`, then start with `docker compose up -d`.
5. Run `docker compose exec backend php artisan db:seed --force` only when creating the first installation, then replace the seeded password.
6. Back up the PostgreSQL and Redis volumes, monitor the backend and queue containers, and use managed secrets in place of a checked-in `.env`.
7. For zero-downtime releases, run migrations as a one-off release task before switching application traffic and ensure migrations remain backward compatible.

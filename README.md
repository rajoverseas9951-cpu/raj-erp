# Raj ERP

Raj ERP contains the existing Customer CRM and Vehicle Master features, a Laravel 12 API backend, frontend source, and architecture documentation.

## Backend requirements

- PHP 8.2 or newer with the PostgreSQL PDO extension (`pdo_pgsql`)
- Composer 2
- PostgreSQL 14 or newer

## Backend installation

From the repository root, run:

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
```

Create the PostgreSQL database and update `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` in `backend/.env`. Then initialize the application:

```bash
php artisan migrate --seed
php artisan storage:link
php artisan route:list
php artisan test
```

The development administrator is configured by `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_TENANT_ID` in `.env`. Change the example password before using the account outside local development. Obtain a Sanctum bearer token with `POST /api/v1/auth/login` and send it as `Authorization: Bearer <token>` to Customer and Vehicle endpoints.

Start the API server:

```bash
php artisan serve --host=127.0.0.1 --port=8000
```

The API health checks are available at `http://127.0.0.1:8000/up` and `http://127.0.0.1:8000/api/health`.

## Testing without PostgreSQL

The automated test suite uses an in-memory SQLite database. For a temporary local migration smoke test only, you can use:

```bash
touch database/database.sqlite
DB_CONNECTION=sqlite DB_DATABASE="$PWD/database/database.sqlite" php artisan migrate:fresh --seed
```

Production and normal local development remain configured for PostgreSQL through environment variables.

## Next.js frontend

The Next.js application in `frontend/` provides secure authentication screens, the existing Customer CRM and Vehicle Master interfaces, and a responsive tenant-aware administration dashboard at `/dashboard`. The dashboard uses reusable App Router layouts, permission-filtered navigation, Tailwind CSS, and persisted light/dark themes. Configure `NEXT_PUBLIC_API_URL` with the Laravel origin, then run `npm install` and `npm run dev` from that directory.

Optional `RAJ_ERP_TENANT_ID` and `RAJ_ERP_TENANT_NAME` environment variables configure the server-rendered dashboard tenant context. In production, populate the same typed dashboard session contract from the authenticated server session without changing module business logic.

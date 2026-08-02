# Vimawallah ERP production deployment

These commands deploy the application without resetting or recreating production data. Run them from the production checkout as the deployment user.

## Required environment

Backend `.env` must already contain production values for:

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://erp.vimawallah.com`
- `FRONTEND_URL=https://erp.vimawallah.com`
- `APP_TIMEZONE=Asia/Kolkata`
- `CORS_ALLOWED_ORIGINS=https://erp.vimawallah.com`
- `SANCTUM_STATEFUL_DOMAINS=erp.vimawallah.com`
- `DB_CONNECTION=pgsql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- `CACHE_STORE`, `SESSION_DRIVER`, `QUEUE_CONNECTION`
- Redis variables when Redis is selected
- Mail variables when password reset email is enabled

Frontend build environment must contain:

- `NEXT_PUBLIC_API_URL=https://erp.vimawallah.com`

Do not put a trailing `/api` or `/api/v1` in `NEXT_PUBLIC_API_URL`; the client appends `/api/v1` exactly once.

## Safe deployment commands

```bash
cd /path/to/raj-erp
git fetch origin
git checkout main
git pull --ff-only origin main

# Take an application-consistent PostgreSQL backup before migrating.
pg_dump --format=custom --file=/secure/backup/raj_erp_$(date +%Y%m%d_%H%M%S).dump "$DATABASE_URL"

cd backend
composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
php artisan migrate --force
php artisan db:seed --class=Database\\Seeders\\VehicleMasterSeeder --force
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

cd ../frontend
npm ci
NEXT_PUBLIC_API_URL=https://erp.vimawallah.com npm run build

# Use the process names already configured on the server.
pm2 reload <backend-process-name> --update-env
pm2 reload <frontend-process-name> --update-env
pm2 save
```

Never run `migrate:fresh`, `db:wipe`, `schema:drop`, `truncate`, or a destructive seeder in production.

## Post-deployment verification

```bash
curl --fail --silent --show-error https://erp.vimawallah.com/api/health
curl --fail --silent --show-error https://erp.vimawallah.com/login > /dev/null
php artisan route:list --path=api/v1
php artisan migrate:status
pm2 status
```

Then sign in and verify Dashboard, Customers, Vehicles, Policies, Accounts, Reports, Settings, Vehicle Masters, and Insurance Masters. Create and update a test policy, confirm dashboard commission and profit change immediately, then remove or cancel that test record through the application.

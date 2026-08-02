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
- `PADDLEOCR_URL=http://127.0.0.1:8081`
- `PADDLEOCR_TIMEOUT=100`

Frontend build environment must contain:

- `NEXT_PUBLIC_API_URL=https://erp.vimawallah.com`

Do not put a trailing `/api` or `/api/v1` in `NEXT_PUBLIC_API_URL`; the client appends `/api/v1` exactly once.

## Safe deployment commands

```bash
cd /path/to/raj-erp
git fetch origin
git checkout main
git pull --ff-only origin main

# Build/start the internal OCR container. The official models download into the
# named volume on the first startup and are reused on later restarts.
cd ocr-service
test -f .env || cp .env.example .env
docker compose -f compose.production.yml build
docker compose -f compose.production.yml up -d
docker compose -f compose.production.yml ps

# Install the loopback-only Nginx listener once, or refresh it after changes.
sudo install -m 0644 deploy/nginx-ocr-internal.conf /etc/nginx/conf.d/ocr-internal.conf
sudo nginx -t
sudo systemctl reload nginx
curl --fail --silent --show-error http://127.0.0.1:8081/health

# Take an application-consistent PostgreSQL backup before migrating.
cd ../backend
pg_dump --format=custom --file=/secure/backup/raj_erp_$(date +%Y%m%d_%H%M%S).dump "$DATABASE_URL"

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
cd /path/to/raj-erp
curl --fail --silent --show-error https://erp.vimawallah.com/api/health
curl --fail --silent --show-error http://127.0.0.1:8081/health
docker compose -f ocr-service/compose.production.yml ps
cd backend
curl --fail --silent --show-error https://erp.vimawallah.com/login > /dev/null
php artisan route:list --path=api/v1
php artisan migrate:status
pm2 status
```

Then sign in and verify Dashboard, Customers, Vehicles, Policies, Accounts, Reports, Settings, Vehicle Masters, and Insurance Masters. Create and update a test policy, confirm dashboard commission and profit change immediately, then remove or cancel that test record through the application.

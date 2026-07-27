#!/bin/sh
set -e
mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs
chown -R www-data:www-data storage bootstrap/cache
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then php artisan migrate --force; fi
exec "$@"

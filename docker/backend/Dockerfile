FROM php:8.3-fpm-alpine AS runtime
RUN apk add --no-cache nginx supervisor libpq-dev icu-dev oniguruma-dev linux-headers $PHPIZE_DEPS \
 && docker-php-ext-install pdo_pgsql intl opcache bcmath \
 && pecl install redis && docker-php-ext-enable redis \
 && apk del $PHPIZE_DEPS
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html
COPY backend/composer.json backend/composer.lock* ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --optimize-autoloader --no-scripts
COPY backend .
RUN composer dump-autoload --no-dev --optimize && chown -R www-data:www-data storage bootstrap/cache
COPY docker/backend/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/backend/supervisord.conf /etc/supervisord.conf
COPY docker/backend/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint
ENTRYPOINT ["entrypoint"]
CMD ["supervisord", "-c", "/etc/supervisord.conf"]

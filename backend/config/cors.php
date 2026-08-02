<?php
return ['paths'=>['api/*','sanctum/csrf-cookie'],'allowed_methods'=>['*'],'allowed_origins'=>array_filter(array_map('trim', explode(',',env('CORS_ALLOWED_ORIGINS','')))),'allowed_origins_patterns'=>[],'allowed_headers'=>['Accept','Authorization','Content-Type','Cache-Control','X-Requested-With','X-Tenant-Id'],'exposed_headers'=>[],'max_age'=>600,'supports_credentials'=>true];

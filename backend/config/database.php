<?php
use Illuminate\Support\Str;
return [
 'default'=>env('DB_CONNECTION','pgsql'),
 'connections'=>[
  'sqlite'=>['driver'=>'sqlite','url'=>env('DB_URL'),'database'=>env('DB_DATABASE',database_path('database.sqlite')),'prefix'=>'','foreign_key_constraints'=>env('DB_FOREIGN_KEYS',true),'busy_timeout'=>null,'journal_mode'=>null,'synchronous'=>null],
  'pgsql'=>['driver'=>'pgsql','url'=>env('DB_URL'),'host'=>env('DB_HOST',''),'port'=>env('DB_PORT','5432'),'database'=>env('DB_DATABASE','raj_erp'),'username'=>env('DB_USERNAME','postgres'),'password'=>env('DB_PASSWORD',''),'charset'=>'utf8','prefix'=>'','prefix_indexes'=>true,'search_path'=>'public','sslmode'=>env('DB_SSLMODE','prefer')],
 ],
 'migrations'=>['table'=>'migrations','update_date_on_publish'=>true],
 'redis'=>['client'=>env('REDIS_CLIENT','phpredis'),'options'=>['cluster'=>env('REDIS_CLUSTER','redis'),'prefix'=>env('REDIS_PREFIX',Str::slug((string)env('APP_NAME','laravel')).'-database-')],'default'=>['url'=>env('REDIS_URL'),'host'=>env('REDIS_HOST',''),'username'=>env('REDIS_USERNAME'),'password'=>env('REDIS_PASSWORD'),'port'=>env('REDIS_PORT','6379'),'database'=>env('REDIS_DB','0')]],
];

<?php
namespace Tests\Feature;
use Tests\TestCase;
class HealthCheckTest extends TestCase { public function test_health_check_is_available(): void { $this->getJson('/api/health')->assertOk()->assertExactJson(['status'=>'ok']); $this->get('/up')->assertOk(); } }

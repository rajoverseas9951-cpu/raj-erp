<?php

namespace Tests\Feature;

use Tests\TestCase;

class ProductionCorsTest extends TestCase
{
    public function test_existing_erp_and_vercel_frontend_origins_are_allowed(): void
    {
        config()->set('cors.allowed_origins', [
            'https://erp.vimawallah.com',
            'https://raj-erp.vercel.app',
        ]);

        foreach (config('cors.allowed_origins') as $origin) {
            $this->withHeaders([
                'Origin' => $origin,
                'Access-Control-Request-Method' => 'POST',
                'Access-Control-Request-Headers' => 'authorization,content-type',
            ])->options('/api/v1/auth/login')
                ->assertNoContent()
                ->assertHeader('Access-Control-Allow-Origin', $origin)
                ->assertHeader('Access-Control-Allow-Headers', 'accept, authorization, content-type, cache-control, x-requested-with, x-tenant-id');
        }
    }

    public function test_manual_production_workflow_preserves_existing_frontend_url(): void
    {
        $workflow = file_get_contents(base_path('../.github/workflows/deploy-production.yml'));

        $this->assertStringContainsString(
            'CORS_ALLOWED_ORIGINS=https://erp.vimawallah.com,https://raj-erp.vercel.app',
            $workflow,
        );
        $this->assertStringContainsString(
            'FRONTEND_URL=https://erp.vimawallah.com',
            $workflow,
        );
        $this->assertStringNotContainsString(
            'FRONTEND_URL=https://raj-erp.vercel.app',
            $workflow,
        );
    }
}

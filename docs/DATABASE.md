# Database Architecture

## Principles
- Use tenant-aware schemas or tenant-scoped records for SaaS isolation.
- Access persistence through repositories only.
- Keep migrations backward compatible for rolling deployments.
- Use audit and activity tables for traceability.

## Core Cross-Cutting Tables

### audit_logs
Stores immutable security, permission, authentication, data-change, and administrative events.

Suggested fields:
- `id`
- `tenant_id`
- `actor_id`
- `actor_type`
- `action`
- `resource_type`
- `resource_id`
- `before_snapshot`
- `after_snapshot`
- `metadata`
- `ip_address`
- `user_agent`
- `created_at`

### activity_logs
Stores user-facing timeline events and operational actions.

Suggested fields:
- `id`
- `tenant_id`
- `actor_id`
- `verb`
- `subject_type`
- `subject_id`
- `message`
- `metadata`
- `created_at`

### notifications
Stores notification lifecycle state.

Suggested fields:
- `id`
- `tenant_id`
- `recipient_id`
- `channel`
- `template_key`
- `payload`
- `status`
- `scheduled_at`
- `sent_at`
- `failed_at`
- `failure_reason`
- `created_at`

### uploaded_files
Stores file metadata while the binary is delegated to a storage provider.

Suggested fields:
- `id`
- `tenant_id`
- `owner_id`
- `storage_provider`
- `bucket`
- `object_key`
- `file_name`
- `mime_type`
- `size_bytes`
- `checksum`
- `visibility`
- `created_at`

## Repository Pattern
Repositories own query construction, persistence details, and data mapping. Services depend on repository interfaces instead of database clients.

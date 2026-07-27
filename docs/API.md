# API Architecture

## Versioning
All API routes must be mounted under a version prefix, for example:

```text
/api/v1/{feature}/{resource}
```

Breaking changes require a new version namespace. Non-breaking additions can remain in the current version.

## Global Success Response
```json
{
  "success": true,
  "data": {},
  "message": "Request completed successfully",
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-07-27T00:00:00.000Z"
  }
}
```

## Global Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request payload is invalid",
    "details": []
  },
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-07-27T00:00:00.000Z"
  }
}
```

## Cross-Cutting Middleware
- Request ID middleware
- Authentication middleware
- Permission middleware
- Validation middleware
- Exception handler
- Audit logging middleware for sensitive routes

## Feature Route Layout
Each feature should expose route definitions from its own folder and register through the API version router.

## Authentication and identity (`/api/v1`)

All authentication requests use JSON and return a consistent `success`, `message`, `data`, and `meta` envelope. Protected endpoints require `Authorization: Bearer <token>`. A tenant UUID is mandatory at authentication boundaries so accounts with the same email address remain isolated.

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| POST | `/auth/login` | Public, rate limited | Issue a 120-minute Sanctum token |
| POST | `/auth/logout` | Sanctum | Revoke the current token |
| POST | `/auth/refresh` | Sanctum | Rotate the current token |
| POST | `/auth/forgot-password` | Public, rate limited | Send a generic, non-enumerating reset response |
| POST | `/auth/reset-password` | Public, rate limited | Consume a single-use reset token |
| PUT | `/auth/password` | Sanctum | Change password and revoke other sessions |
| GET/POST | `/users` | `users.view` / `users.create` | Tenant-scoped list and create |
| GET/PUT/DELETE | `/users/{id}` | Matching user permission | Tenant-scoped user operations |
| GET | `/roles` | `users.view` | List tenant roles and permissions |

Login requires `tenant_id`, `email`, and `password`; `device_name` is optional. Forgot-password requires `tenant_id` and `email`. Reset-password requires those fields plus `token`, `password`, and `password_confirmation`. User create/update accepts `name`, `email`, optional `is_active`, `role_ids`, and a confirmed password (required for create).

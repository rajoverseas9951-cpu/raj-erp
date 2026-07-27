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

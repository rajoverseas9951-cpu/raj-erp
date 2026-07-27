# Coding Standards

## Architecture
- Prefer feature-based folders over page-based folders.
- Keep business logic in services.
- Keep persistence logic in repositories.
- Keep controllers thin and focused on transport concerns.
- Use shared middleware for cross-cutting concerns.
- Use typed exceptions and global response helpers.

## Feature Folder Contract
Each feature should follow this structure when implemented:

```text
src/features/{feature-name}/
  controllers/
  dtos/
  repositories/
  routes/
  services/
  tests/
  types/
  index.ts
```

## Naming
- Use descriptive names over abbreviations.
- Use `PascalCase` for classes and types.
- Use `camelCase` for functions and variables.
- Use `UPPER_SNAKE_CASE` for constants.

## Error Handling
- Throw application exceptions from domain and service code.
- Convert exceptions to API responses only in the global exception handler.
- Never leak stack traces or provider-specific details to clients.

## Imports
- Do not wrap imports in try/catch blocks.

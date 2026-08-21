# ERP control-plane integration foundation

```text
Vimawallah Super Admin (control plane)
        |
        | future authenticated, replay-protected connector
        v
raj-erp control configuration
        |-- tenant ACTIVE/SUSPENDED state
        |-- module entitlements
        |-- branch access/isolation context
        |-- protected integration health
        v
ERP operational modules (data plane)
```

## Implemented now

- The existing `tenants` record is the central ERP tenant identity. The development default is `VIMAWALLAH_INTERNAL`, using `https://erp.vimawallah.com` for both base and tenant URLs.
- Dhanera (`VIMA-DHN-001`) and Tharad (`VIMA-THR-002`) are branches of the same tenant and application instance.
- `BranchContext` resolves `X-Branch-Code` only on the server, verifies tenant ownership and user assignment, and exposes a reusable query-scoping method. Existing users retain tenant-wide branch access during this compatibility phase.
- The module registry and database entitlements enforce tenant and optional branch overrides server-side. The frontend helper can filter navigation from a trusted enabled-module list.
- Normal authenticated API routes are blocked when the tenant is suspended. Public service health, authentication, and the protected ERP-control health endpoint remain available.
- `GET /api/v1/internal/erp-control/health` requires a valid Sanctum user and returns no secrets.
- Typed PHP control-plane request/result contracts exist, but there is deliberately no mutation endpoint or Super Admin HTTP client.

## Still required before connector rollout

- Add authenticated connector credentials, signing, replay protection, idempotency, audit logging, and transactional application of `ControlPlaneConfiguration`.
- Add `branch_id` to each operational aggregate that requires branch isolation (customers, vehicles, policies, renewals, documents, accounting records and reports), backfill deliberately, then adopt `BranchContext::scope()` in repositories/controllers. The current foundation validates branch access but cannot retroactively isolate rows that have no branch column.
- Return trusted module/branch context in the authenticated session/bootstrap response and wire `filterModuleNavigation` into the live sidebar. Browser values must never become the authorization source.
- Decide whether tenant-wide reporting users may aggregate branches and add explicit permissions and tests.

No DNS, deployment, Super Admin repository, or `erp.vimawallah.com` infrastructure is changed by this work.

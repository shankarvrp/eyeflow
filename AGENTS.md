# EyeFlow agent guide

These instructions apply to the entire repository.

## Product boundaries

EyeFlow is an eye-clinic operations product. Treat patient and financial data as sensitive. Do not add telemetry, third-party data transfer, or clinical decision support without an explicit requirement and threat review.

## Engineering rules

- Keep TypeScript strict. Never introduce explicit or implicit `any`.
- Organize application code by feature; keep business rules outside React components.
- Validate every external boundary. Database constraints are required but do not replace request validation.
- Enforce authorization server-side. Hiding a tab is not an RBAC control.
- Store money as fixed-precision decimal values, never floating-point database columns.
- Record auditable business mutations with actor, time, reason, and before/after state.
- Use Drizzle schema changes and generated migrations. Do not edit an applied migration.
- Prefer shared UI primitives from `@eyeflow/ui` and preserve keyboard and screen-reader behavior.
- Keep the app runnable after every change. Avoid speculative packages and abstractions.

## Required verification

Run the smallest relevant checks while iterating, then before handoff run:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

Run `pnpm test:e2e` when user-visible behavior changes. Update documentation and `.env.example` when configuration changes.

## Commit scope

Use Conventional Commits. Do not modify or discard unrelated user changes. Never commit `.env`, credentials, generated browser reports, or local databases.

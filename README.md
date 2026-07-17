# EyeFlow

EyeFlow is a modern, local-first revenue and practice-operations platform for eye clinics. The first vertical slice focuses on daily collections across OPD, Investigation, Pharmacy, OT, and Opticals.

## Foundation

- React 19 and TanStack Start
- TypeScript strict mode with no implicit `any`
- Tailwind CSS v4 and a shadcn-ready shared UI package
- TanStack Query, Form, and Table
- Drizzle ORM and PostgreSQL
- Better Auth email/password sessions with role and department-level RBAC
- pnpm workspaces and Turborepo
- Biome, Vitest, Playwright, and GitHub Actions
- Docker Compose for local infrastructure and Kustomize manifests for K3s

## Requirements

- Node.js 22.12 or later
- pnpm 11.7
- Docker Desktop or another Docker-compatible runtime for PostgreSQL

## Quick start

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The development seed creates `admin@eyeflow.local` with password
`EyeFlowAdmin123!`. It also creates `user@eyeflow.local` with password
`EyeFlowUser123!`. Override the `EYEFLOW_ADMIN_*` and `EYEFLOW_USER_*` values in
`.env`, and never use the development passwords with real clinic data.

To run the application and PostgreSQL together as containers:

```bash
docker compose up --build
```

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start all development tasks |
| `pnpm build` | Create production builds |
| `pnpm check` | Run Biome formatting and lint checks |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run Playwright browser tests |
| `pnpm db:generate` | Generate a Drizzle migration from the schema |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:seed` | Seed departments, demo collections, and development admin/user accounts |
| `pnpm db:studio` | Open Drizzle Studio |

## Repository layout

```text
apps/web        TanStack Start application
packages/auth   Better Auth composition point
packages/db     Drizzle schema, client, and migrations
packages/shared Cross-feature domain types
packages/ui     Shared shadcn-ready primitives
infra/k8s       Kustomize base for K3s/Kubernetes
docs            Architecture and engineering guidance
```

## Configuration

Copy `.env.example` to `.env`. Development defaults are intentionally non-secret. Generate production secrets independently and never commit them.

The Kubernetes manifests expect an `eyeflow-secrets` Secret. Copy `infra/k8s/base/secret.example.yaml` outside the repository, replace its values, apply it, and then run:

```bash
kubectl apply -f /secure/path/eyeflow-secrets.yaml
kubectl apply -k infra/k8s/base
```

## Project status

Project Genesis establishes a tested, deployable foundation and a polished dashboard shell. A single Add Collection workflow records cash, credit, online, and discounts across every permitted department in one atomic save. Recent Collections now has a Patient-wise companion tab that consolidates every visible payment for a patient and provides one workspace for updating the patient name, departments, payment modes, providers, amounts, and discounts. Patient workspace edits are atomic and record an audit event with the actor, reason, and before/after state. The two supported roles are `admin` and `user`: users can edit current-day collections, while admins can also edit history. Daily targets are shared with both roles; weekly and monthly targets are returned only to administrators. Better Auth protects the dashboard and server functions, department access is stored per user, and each new payment records its actor. User administration, date filtering, exports, and live multi-user updates arrive in subsequent vertical slices.

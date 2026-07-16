# EyeFlow

EyeFlow is a modern, local-first revenue and practice-operations platform for eye clinics. The first vertical slice focuses on daily collections across OPD, Investigation, Pharmacy, OT, and Opticals.

## Foundation

- React 19 and TanStack Start
- TypeScript strict mode with no implicit `any`
- Tailwind CSS v4 and a shadcn-ready shared UI package
- TanStack Query, Form, and Table
- Drizzle ORM and PostgreSQL
- Better Auth composition point for authentication and RBAC
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
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

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

Project Genesis establishes a tested, deployable foundation and a polished dashboard shell. The Add Collection vertical slice supports validated patient, department, payment-mode, amount, discount, and provider/mode entry with PostgreSQL persistence and immediate dashboard updates. Authentication routes, RBAC enforcement, audit events, date filtering, exports, and live multi-user updates arrive in subsequent vertical slices.

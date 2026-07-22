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

The development seed creates both supported roles:

| Role | Email | Password | Access |
| --- | --- | --- | --- |
| Administrator | `admin@eyeflow.local` | `EyeFlowAdmin123!` | All departments, historical editing, extended date ranges, weekly/monthly targets |
| User | `user@eyeflow.local` | `EyeFlowUser123!` | Assigned departments, same-day editing, current-month viewing, daily target |

Override the `EYEFLOW_ADMIN_*` and `EYEFLOW_USER_*` values in `.env`, and never
use the development passwords with real clinic data.

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
| `pnpm emr:login` | Fallback: establish the FOSS EHR session from a terminal |
| `pnpm emr:sync [YYYY-MM-DD]` | Fallback: synchronize an explicit date from a terminal |

## FOSS EHR patient and receipt synchronization

FOSS EHR does not expose a supported patient API, so EyeFlow uses an operator-controlled
Playwright browser profile. An administrator selects **Connect EMR** on the dashboard and completes
the login in the private browser window that EyeFlow opens. EyeFlow stores only the resulting local
browser profile under `.eyeflow/`; it never requests or stores the EMR password.

Once connected, any signed-in user can select **Sync EMR** for the active day. EyeFlow synchronizes
both appointments and **Receipts → All Collection Receipts** at the interval configured by `EMR_SYNC_INTERVAL_MINUTES`
(15 minutes by default) while at least one authenticated dashboard is open. The terminal commands
remain available as recovery and diagnostic tools, but they are not required for routine use.

The connector imports the stable patient number, display name, appointment identifier/date, visit
type, receipt identifier/date, source department, payment mode, and amount. It deliberately excludes
phone numbers, credentials, and clinical details; receipt remarks are used transiently for mapping
and are not stored. In Add Collection, the patient field becomes a searchable picker for
the selected collection date. Patients without an existing EyeFlow record carry a green **New**
badge. Selecting a patient prefills unused receipts as editable department payment drafts. Known
labels are mapped deterministically (including IPD/surgery to OT); refunds and unknown labels are
flagged for manual review. Nothing becomes a final EyeFlow transaction until the user saves, and a
stored receipt-to-payment link prevents duplicate submission.

Mapped, unused receipts also appear in Recent Collections, summaries, pagination, and exports with
a **Synced receipt** badge. Once reviewed and saved, the linked EyeFlow payment replaces the imported
row without double-counting. A connected dashboard starts one non-blocking synchronization for today
when it loads, then continues on the configured interval.

Every user sees mid-day and end-of-day handover badges with separate user and administrator status
halves. Each period requires both roles to reconcile and sign off; administrators can close the day
only after all four declarations tally with the overall collection. Closing stores a summary snapshot
and locks collection mutations until an administrator reopens it with an audited reason.

The connector is intended for a trusted local host with a graphical browser environment. The saved
EMR session is sensitive, is ignored by Git, and must not be copied into images or shared storage.
Closing every EyeFlow dashboard pauses automatic synchronization; the manual button remains the
immediate recovery path after reopening the app. A continuously running Kubernetes deployment will
need a dedicated browser worker before this connector can be enabled there. Because the integration
follows the EMR user interface, rerun its parser tests and review selectors whenever the EMR UI changes.

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

Project Genesis establishes a tested, deployable foundation and a polished dashboard shell. The Add Collection workflow opens with OPD and Pharmacy as the primary departments; Investigation, OT, and Opticals can be added on demand. Every active department supports repeat payments in the same or different modes, and the complete patient collection is saved atomically with its collection date. Recent Collections and Patient-wise views include both EyeFlow and synchronized EMR receipts, are paginated, and open the same multi-department collection workflow for editing. Users may browse the current month and edit today's entries; administrators may browse extended history, enter or edit historical collections, and see weekly/monthly targets. Excel and PDF exports contain the complete role-filtered result set rather than only the visible page. Administrators can enable a live dashboard connection to receive pushed collection updates without refreshing. Better Auth protects the dashboard and server functions, department access is stored per user, and every payment records its actor. The local FOSS EHR browser connector synchronizes a minimal patient/appointment catalog for the collection picker without storing EMR credentials; automatic synchronization is explicitly opt-in and can otherwise be run only from the Sync EMR button.

Revenue now provides an operational payment ledger and department contribution view. Patients is an
exhaustive, searchable, paginated EMR and EyeFlow directory with expandable visit and collection
history. Reports includes date/department collections, cohort-based Pharmacy and Opticals conversion,
administrator-only weekly/monthly target gaps, and observed patient time from the scheduled EMR
appointment to the patient's last receipt. Department targets are configured by administrators.
Audited role/department access management is active. Configurable payment/provider masters and a
shared multi-instance event backplane are planned next.

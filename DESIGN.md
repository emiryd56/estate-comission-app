# Design & Architecture

This document captures the rationale behind the architectural and
implementation choices in **estate-comission-app**. It is intended to be
read alongside the source code: every section answers "why is it like
this?" rather than "what does it do?".

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Choices](#2-technology-choices)
3. [Domain Model](#3-domain-model)
4. [Commission Rules](#4-commission-rules)
5. [Stage State Machine](#5-stage-state-machine)
6. [Concurrency & Atomic Updates](#6-concurrency--atomic-updates)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [API Design](#8-api-design)
9. [Backend Module Layout](#9-backend-module-layout)
10. [Frontend Architecture](#10-frontend-architecture)
11. [State Management Strategy](#11-state-management-strategy)
12. [UI/UX Decisions](#12-uiux-decisions)
13. [PDF Export Pipeline](#13-pdf-export-pipeline)
14. [Security Posture](#14-security-posture)
15. [Observability & Health](#15-observability--health)
16. [Testing Strategy](#16-testing-strategy)
17. [Developer Experience](#17-developer-experience)
18. [Trade-offs & Future Work](#18-trade-offs--future-work)

---

## 1. System Overview

The application is a classic two-tier SPA + REST architecture:

```
┌──────────────────┐      HTTPS / JSON      ┌──────────────────┐
│   Nuxt 3 client  │ ──────────────────────▶│    NestJS API    │
│  (browser SPA)   │ ◀──────────────────────│    (Node.js)     │
└──────────────────┘   Authorization: Bearer└─────────┬────────┘
                                                      │ mongoose
                                                      ▼
                                             ┌──────────────────┐
                                             │  MongoDB Atlas   │
                                             └──────────────────┘
```

- The frontend is a single-page Nuxt app. It holds no domain state of its
  own; everything is fetched from the REST API and cached in Pinia stores.
- The backend is a single NestJS process exposing a stateless REST API.
  State lives in MongoDB; the server keeps nothing in memory other than
  transient request context.
- Authentication is stateless too: access is granted via a signed JWT
  carried as a bearer token. There is no server-side session store.

This split was chosen for operational simplicity (one Node process, one
MongoDB cluster), clean separation of concerns (the SPA owns the UX, the
API owns domain rules), and straightforward horizontal scaling (the API
is stateless, so adding instances behind a load balancer is trivial).

---

## 2. Technology Choices

### NestJS (backend)

- **Structured by default.** Modules, providers, and controllers are a
  better starting point for a business-rule-heavy app than raw Express:
  we get DI, guards, pipes, decorators, and lifecycle hooks out of the
  box. The domain is still small but commission logic, stage machines,
  and RBAC already benefit from a framework that encourages seams.
- **First-class validation.** The global `ValidationPipe` + DTOs using
  `class-validator` turn "validate the request" into declarative metadata
  rather than procedural checks. That removes whole categories of bugs
  (missing fields, type coercion) without extra code in controllers.
- **Great Mongo story.** `@nestjs/mongoose` bridges Mongoose schemas and
  Nest's DI, and plays nicely with `ConfigModule` for env-based wiring.

### MongoDB + Mongoose

- **Flexibility around an evolving document shape.** Transactions carry
  embedded sub-documents (`stageHistory`, `financialBreakdown`) that are
  read and written atomically with the parent. A document database makes
  this natural; in a relational model it would require extra tables and
  joins without adding value for our access patterns.
- **Atlas in the loop.** Managed Mongo removes replication, backups and
  connection management from the plate. The free M0 tier is plenty for
  development and review.
- **Atomic document updates.** Mongo's per-document atomicity (`$set`,
  `$push` inside a single `findOneAndUpdate`) is exactly the primitive
  we need for concurrency-safe stage transitions (see §6).

### Nuxt 3 (frontend)

- **Vue 3 Composition API + SSR-ready by default.** Even though we deploy
  as a traditional SPA, Nuxt's file-based routing, auto-imports, Vite
  pipeline and Nitro server make the developer loop fast and the output
  small.
- **Pinia integration.** The official state manager works seamlessly
  with Nuxt's auto-import story. No boilerplate glue.
- **First-class TypeScript.** Templates and `<script setup lang="ts">`
  feel like writing regular components while still yielding full type
  inference for props, refs and computed values.

### Tailwind CSS

- **Utility-first gives consistency without a bespoke design system.**
  We get pixel-aligned spacing, accessible default colors, and dark-mode
  ready primitives with zero custom CSS debt.
- **Tree-shaken by default.** The final bundle ships only the classes
  we actually use, keeping the CSS surface tiny.

### Other libraries

- **`pdfkit` + DejaVu fonts** — pure Node PDF generation without a
  headless browser. Bundling TTFs lets us render Turkish glyphs that
  the default pdfkit fonts cannot.
- **`@nestjs/throttler`, `helmet`** — batteries-included hardening.
- **`@nestjs/terminus`** — production-grade health checks.
- **`@nestjs/swagger`** — API documentation generated from the code.
- **`concurrently`** — tiny, dependency-free process multiplexer for
  `npm run dev`.

---

## 3. Domain Model

The core aggregate is **Transaction**:

```ts
Transaction {
  _id: ObjectId
  title: string                         // free-form deal name
  stage: 'agreement' | 'earnest_money' | 'title_deed' | 'completed'
  totalFee: number                      // gross commission agreed with client
  listingAgent: ObjectId ref User
  sellingAgent: ObjectId ref User
  stageHistory: StageHistoryEntry[]     // append-only audit log
  financialBreakdown?: {                // populated on COMPLETED
    companyCut: number
    listingAgentCut: number
    sellingAgentCut: number
  }
  createdAt / updatedAt                 // via timestamps: true
}

StageHistoryEntry {
  stage: TransactionStage
  changedAt: Date
  changedBy?: ObjectId ref User         // who advanced the stage
}
```

Design decisions worth calling out:

- **Embedded `stageHistory` and `financialBreakdown`.** These
  sub-documents are always read with their parent and never queried in
  isolation; embedding keeps fetches single-document and single-round-trip.
- **`totalFee` is the **agreed** commission, not the property price.**
  That mirrors the business scenario: the agency negotiates a commission
  number up-front; internal splits only happen afterwards. Keeping the
  derived split separate from the agreed total keeps the model honest.
- **`stage` is denormalized from `stageHistory`.** We could compute the
  current stage from the last history entry, but materializing it into a
  top-level property makes list queries, indexes, and UI rendering
  straightforward. The invariant (`stage === last(stageHistory).stage`)
  is enforced in a single code path (`updateStage`), so drift is
  intentional-free.
- **`financialBreakdown` is optional until completion.** We could have
  defaulted it to all-zeros at creation, but leaving it `undefined`
  communicates intent: "no money has been split yet". UIs and reports
  use its presence as the signal for "completed deal".
- **`User` carries a `role` enum (`admin` | `agent`).** A flat role field
  keeps the RBAC logic simple — we do not need multi-role or permissions
  yet, and adding complexity preemptively would be speculative.

---

## 4. Commission Rules

Implemented by [`backend/src/transactions/utils/commission-calculator.ts`](./backend/src/transactions/utils/commission-calculator.ts).

Given a `totalFee` (`T`) and two agent ids (`L`, `S`) the pure function
returns:

| Scenario                     | Agency cut   | Listing agent cut | Selling agent cut |
| ---------------------------- | ------------ | ----------------- | ----------------- |
| `L === S` (same agent)       | `0.5 × T`    | `0.5 × T`         | `0`               |
| `L !== S` (different agents) | `0.5 × T`    | `0.25 × T`        | `0.25 × T`        |

Why this shape:

- The **agency always keeps 50%** of the gross commission. The ratio
  lives in a named constant (`AGENCY_SHARE_RATIO`) so updates are a
  one-line change plus tests.
- The remaining half is the **agent pool**, split evenly when two
  different agents were involved. If one person both listed and sold the
  property, they get the entire pool; the selling-agent cut becomes `0`
  rather than duplicating the amount.
- **The function is pure.** It does not touch the database, take a
  document, or throw for business-logic reasons other than invalid input
  (`totalFee < 0`, `NaN`). That is deliberate: unit tests are trivial and
  the function is reusable anywhere (PDF rendering, future reports,
  hypothetical simulations).
- **Idempotency.** Because `updateStage` passes the stage as a
  precondition (see §6), `calculateCommission` runs at most once per
  transaction — the moment we cross into `COMPLETED`.

---

## 5. Stage State Machine

Defined by [`backend/src/transactions/utils/stage-transitions.ts`](./backend/src/transactions/utils/stage-transitions.ts):

```
AGREEMENT ─▶ EARNEST_MONEY ─▶ TITLE_DEED ─▶ COMPLETED
     ▲             ▲              ▲             │
     └─ no regression allowed ────┘             └─ terminal
```

The allowed-transitions table is a `Readonly<Record<stage, stage[]>>`,
and `canTransition(current, next)` is a one-liner that looks up the
target in the array.

Why a table instead of ad-hoc checks:

- **Single source of truth.** The controller, the service, and the tests
  all consult the same table. You cannot forget a case.
- **Testable in isolation.** The spec exhaustively covers valid forward
  moves, skipping, regression, self-transitions, and the terminal state.
- **Easy to evolve.** Allowing "admin override" or a "reject" branch is a
  table edit, not a refactor of `if` chains.

We intentionally do **not** allow going backwards. In a real agency
system reverting a stage (e.g. a title deed falls through) would
typically require cancellation with a paper trail, not an undo. Modelling
that properly is future work; for now, the terminal `COMPLETED` and
forward-only rule keep the audit log clean.

---

## 6. Concurrency & Atomic Updates

Early versions of `updateStage` followed a read–modify–write pattern:

```ts
const doc = await model.findOne({...});
doc.stage = nextStage;
doc.stageHistory.push({...});
await doc.save();
```

That is unsafe: two clients can each read the same `AGREEMENT` document
and both save it as `EARNEST_MONEY`, producing two history entries and a
potential double-advance later.

The current implementation relies on **MongoDB's per-document atomic
updates** by making the current stage part of the filter:

```ts
await model.findOneAndUpdate(
  { _id, stage: current.stage },           // precondition
  { $set: { stage: nextStage, /* breakdown */ },
    $push: { stageHistory: { ... } } },
  { new: true },
);
```

If the document was already advanced by another writer, the filter no
longer matches, `findOneAndUpdate` returns `null`, and the service
throws `ConflictException` (HTTP 409). The frontend's `useApi` surfaces
the message and the user can reload and retry.

Why this shape rather than `session.withTransaction`:

- **Single-document atomicity is already guaranteed** by Mongo. There is
  no cross-document invariant that needs a multi-document transaction
  here; the entire state change lives inside one document.
- **No replica-set requirement.** Multi-document transactions require a
  replica set or mongos router; the atomic filter approach works on any
  Mongo topology including Atlas M0.
- **Explicit, conflict-surfacing semantics.** A 409 tells the caller
  exactly what happened and suggests the remedy (reload + retry) rather
  than hiding the race behind a last-writer-wins overwrite.

A pre-check `findOne` is still performed to produce sharper error
messages (`NotFoundException`, `BadRequestException` for invalid
transitions or same-stage) before attempting the atomic swap. The
pre-check is advisory — the real contract is enforced by the
`findOneAndUpdate` filter.

---

## 7. Authentication & Authorization

### Login

`POST /auth/login` accepts `{ email, password }`. The service loads the
user with `+password` selected (the field is `select: false` by default),
verifies with `bcrypt.compare`, and signs a JWT `{ sub, email, role }`
with the configured secret and TTL. Passwords are hashed with bcrypt
(`saltRounds = 10`) in a Mongoose `pre('save')` hook so the service
layer never touches raw secrets.

### Session transport

- The JWT is returned to the client and stored by the frontend in a
  **`lax` cookie named `token`**. `lax` offers CSRF resistance for cross-
  site navigations while still supporting top-level GETs, and it lets us
  share cookies across dev ports more forgivingly than `strict`.
- The cookie is **not `HttpOnly`**. Because the Nuxt side uses `$fetch`
  with a typed `Authorization` header rather than relying on cookie
  auto-send, `HttpOnly` would force us to round-trip through a server
  middleware. The trade-off: XSS on the SPA could read the cookie. We
  mitigate by setting `helmet` on the API and keeping SPA input surface
  small; a strict CSP + HttpOnly cookie is the logical next step if the
  product grows.

### Bearer header

- Every authenticated call attaches `Authorization: Bearer <jwt>` via a
  typed `useApi` composable. Centralising this means future changes
  (refresh tokens, request retry, tracing) have one home.
- On any `401` response the composable clears the cookie and redirects
  to `/login`. That turns expired or revoked tokens into a predictable
  UX event rather than a sequence of broken API calls.

### RBAC

- A `@Roles(...roles)` decorator attaches metadata to handlers/classes.
- `RolesGuard` reads the metadata, compares it against the authenticated
  user's role, and throws `ForbiddenException` when mismatched.
- The Transactions controller declares `@Roles(ADMIN, AGENT)` at the
  class level: both roles reach every endpoint. The stricter "agent
  must be involved" check is implemented **inside the service**
  (`assertAgentInvolvement`) because it depends on request payload, not
  just the role name. That keeps guards concerned with identity, services
  concerned with business rules.
- The Users controller uses the same mechanism to keep `POST /users`
  admin-only while opening `GET /users` to both roles so agents can pick
  colleagues when creating transactions.

### JWT hygiene on the client

`frontend/utils/jwt.ts` centralises `decodeJwtPayload`, `isTokenExpired`
and `isValidSession`. The Nuxt plugin uses them to hydrate the Pinia
store on cold start, and the global route middleware uses them to fail
fast on expired tokens. Duplicating this parsing would have been a
typical seam for subtle bugs; consolidating it means **"do I still have
a usable session?"** is one call.

---

## 8. API Design

- **Resource-oriented routes.** `/transactions`, `/transactions/:id`,
  `/transactions/:id/stage`, `/transactions/:id/export`,
  `/users`, `/auth/login`. Matches everyday REST expectations.
- **Explicit DTOs with validators on every payload.** Gives us 400 with
  precise messages instead of uncaught exceptions, and lets Swagger
  introspect the schema.
- **Uniform pagination.** `PaginatedResult<T> = { data, total, page,
  totalPages }` across the app. Predictable shape → one frontend code
  path for pagination.
- **Status codes.** `201` on create, `200` on stage patch, `409` on
  concurrent conflict, `401` on missing/invalid token, `403` on role
  mismatch, `404` on "not found or not yours" (agent scope is applied by
  the filter, so inaccessible documents look identical to nonexistent
  ones to the caller).
- **Stage update as PATCH `/transactions/:id/stage`.** The resource we
  are mutating is the stage field of the transaction, so dedicating a
  sub-path makes the intent explicit and opens the door to `PATCH` on
  other fields later without URL collisions.
- **PDF export as a dedicated GET.** Returning a `Content-Type:
  application/pdf` stream from the same resource tree keeps the client
  simple (`fetch`, blob, `URL.createObjectURL`) and respects
  content-negotiation conventions.
- **Filtering query params are optional and additive.** Each filter is
  an independent `$and`-able clause inside the service, so combinations
  "just work" without controller-side wiring.

---

## 9. Backend Module Layout

```
app.module.ts
├── ConfigModule (global)
├── MongooseModule (forRootAsync with ConfigService)
├── ThrottlerModule (global guard)
├── TerminusModule           → /health
├── AuthModule               → /auth/login, /auth/me
├── UsersModule              → /users
└── TransactionsModule       → /transactions[, /stage, /export]
```

Design choices:

- **Config is loaded once, globally.** Individual modules inject
  `ConfigService` rather than reading `process.env` directly, keeping the
  env surface reviewable and testable.
- **Throttler is wired as `APP_GUARD`.** Every request is rate-limited by
  default, and endpoint-specific overrides (e.g. stricter login
  throttling via `@Throttle`) are additive.
- **`AppController` owns `/health`, nothing else.** The default
  NestJS boilerplate (`AppService.getHello`) was deleted; keeping only
  meaningful code in the root module avoids the "it's still there from
  `nest new`" smell.
- **Filter builders live inside `TransactionsService`.** They are
  private methods (`buildAccessFilter`, `buildSearchFilter`, …) that
  each return a small Mongo filter fragment. The public `findAllPaginated`
  composes them with spread. Six short, named functions are easier to
  scan and test than one 80-line procedural method.

---

## 10. Frontend Architecture

```
app.vue
└── layouts/default.vue       (sidebar + main outlet, hidden on /login)
    └── pages/
        ├── index.vue         (dashboard / transactions list)
        ├── transactions/[id].vue (detail + PDF + timeline + breakdown)
        ├── transactions/new.vue  (create form with SearchableSelect)
        ├── users.vue             (admin-only, manage users)
        └── login.vue             (no layout)

plugins/auth.ts               hydrates the Pinia auth store on cold start
middleware/auth.global.ts     enforces login + admin-only routes
composables/useApi.ts         typed $fetch with bearer + 401 redirect
utils/{jwt,stage,error}.ts    pure helpers shared by stores/pages
components/SearchableSelect.vue  generic combobox (used by dashboard + form)
stores/{auth,user,transaction}.ts  Pinia stores
types/{transaction,user}.ts   mirrored backend contracts
```

Why the split:

- **Pages are orchestrators; stores own data.** Pages read from stores
  via Pinia getters, trigger actions, and map them to the DOM. Fetch
  logic never lives in a component so the same data can power two pages
  consistently.
- **Composables wrap side-effectful primitives.** `useApi` is the only
  place `$fetch` is configured; replacing it with `useFetch` or adding
  retries is a single-file change.
- **Middleware vs plugin.** The plugin runs once at startup to hydrate
  the store from the JWT; the middleware runs on every navigation to
  gate routes. Using both keeps the first paint accurate and subsequent
  transitions snappy without a network round-trip.
- **Shared `utils/`.** `jwt.ts` (decode/expiry), `stage.ts` (labels,
  currency, next-stage helper), and `error.ts` (fetch-error flattener)
  are pure and unit-testable. Centralising them was a direct response to
  duplicated `decodeJwtPayload` and `isFetchError` logic that had crept
  in between the middleware and the plugin.

---

## 11. State Management Strategy

Three Pinia stores, each with a single responsibility:

- **`auth`** — holds the currently authenticated user; exposes
  `isAuthenticated` and `isAdmin`; actions are `login`, `hydrate`,
  `logout`. Cookie lifecycle lives here so it is the only thing that
  writes `token`.
- **`user`** — holds the roster of users the UI needs (pickers, admin
  page); exposes `agents` (agent-only subset) and `getById`. Owns
  `fetchUsers`, `createUser`.
- **`transaction`** — holds the current page of transactions plus all
  filter state (`search`, `stage`, `advancedFilters`), pagination, and
  UI flags (`loading`, `error`). Actions consolidate fetch, create,
  update-stage, and filter operations so pages stay declarative.

Why Pinia + dedicated stores instead of component-local `ref`s:

- **Cross-page continuity.** Landing on `/transactions/[id]` after
  filtering the dashboard should not reset filters when the user returns.
  Store-level state makes the "back to list" experience preserve context.
- **Deterministic filter pipeline.** `fetchTransactions` receives an
  options bag; the `if ('key' in options)` check was a deliberate
  correction over `if (options.key !== undefined)` because the latter
  cannot distinguish "unset" from "explicitly cleared". That subtlety
  was the source of the "All stages" bug fixed earlier in the project.
- **Typed actions > watchers.** Actions describe intent (`setAdvancedFilters`,
  `resetFilters`, `setPage`). Pages call these instead of poking state
  directly, which keeps the update surface narrow.

---

## 12. UI/UX Decisions

- **Collapsible "Advanced Filters" panel** inside the main filter bar.
  It keeps the default UI clean while making power-user filters
  discoverable (a badge shows the active advanced-filter count).
- **`SearchableSelect` component.** Native `<select>` becomes painful
  with more than ~20 options and cannot be searched. A custom combobox
  with keyboard navigation, search, and clearability scales to dozens
  of agents and keeps the form feeling fast. It is reused for the
  dashboard's agent filter and the new-transaction form.
- **Stage badges with semantic colors** (slate / amber / sky / emerald)
  echo between table rows, detail page, and PDF, so users learn the
  mapping in one place and can rely on it everywhere.
- **Vertical timeline** on the detail page mirrors the four-step state
  machine. "Done / current / pending" have distinct shapes and colors
  so the current step is identifiable at a glance.
- **Inline PDF download** via `fetch` + `blob` + `URL.createObjectURL`
  preserves bearer auth (a plain `<a href>` cannot set headers) and
  lets the server attach a content-aware `Content-Disposition` filename.
- **500 ms debounce on search** prevents hammering the API on every
  keystroke. 500 ms is a common sweet spot between "feels responsive"
  and "reasonably cheap".
- **Consistent action button sizing** (fixed `h-8`, `whitespace-nowrap`)
  — a small detail but keeps tables from bouncing vertically when cells
  contain different-length labels.

---

## 13. PDF Export Pipeline

`GET /transactions/:id/export` returns a PDF built with `pdfkit`:

1. The service loads the transaction with populated agents and returns a
   hydrated Mongoose document.
2. `buildTransactionPdf` registers embedded DejaVu fonts (Sans + Sans
   Bold) so Turkish diacritics render correctly and consistently across
   platforms.
3. The document is written to a `Buffer` by collecting `doc.on('data')`
   chunks into an array inside a `Promise`. Only after `doc.on('end')`
   resolves does the controller send the buffer with explicit
   `Content-Type`, `Content-Length` and `Content-Disposition` headers.

Why buffer-then-send instead of streaming straight into the response:

- **Deterministic error handling.** If font registration or any drawing
  operation throws, we can surface a 500 with a clean body. Streaming
  directly would mean headers were already flushed when the error
  happens — clients see a truncated, "successful" download.
- **Cleaner Content-Length.** We know the final byte count, so clients
  can render progress indicators correctly.
- **Simpler testing.** Unit-testing a function that returns a `Buffer`
  is trivial compared to one that pokes a mutable `Response`.

Assets strategy:

- The font TTFs live under `backend/src/assets/fonts/` and are copied to
  `backend/dist/assets/fonts/` at build time via `nest-cli.json`'s
  `assets` block. At runtime the module resolves the path relative to
  `__dirname`, which works uniformly for `nest start`, `node dist/main`,
  and test runners.

---

## 14. Security Posture

- **Helmet** sets standard protective headers (`X-Content-Type-Options`,
  `Referrer-Policy`, etc.). CSP is left off because Swagger UI and
  arbitrary embedded front-end hosts would otherwise need careful
  allow-listing; once the deployment story is fixed this is a small
  hardening win.
- **`@nestjs/throttler`** rate-limits every request (100/min per IP by
  default) and tightens `POST /auth/login` to 10/min to blunt password
  brute-force attempts.
- **CORS** origins come from `CORS_ORIGIN` (comma-separated). The
  default for dev is `http://localhost:3000`, but production deployments
  should set this explicitly to the deployed frontend URL.
- **Global `ValidationPipe`** uses `whitelist: true` and
  `forbidNonWhitelisted: true`, so any unknown field in a payload fails
  fast. Implicit conversion + `class-transformer` make query strings
  (`page=2`) safe to consume as numbers.
- **Password at rest.** Hashed with bcrypt `saltRounds = 10`; the field
  is `select: false` so `findOne` / `findById` never accidentally hand
  the hash to the outside world.
- **Role enforcement on the server**, not on the client. The frontend
  may hide the "Users" link for non-admins, but the backend independently
  rejects the request via the `RolesGuard`.
- **No sensitive data is returned by `GET /users`** — responses are
  plain users without password fields, thanks to the default schema
  select settings.

---

## 15. Observability & Health

- **`GET /health`** (Terminus) pings MongoDB and returns a well-known
  JSON shape. This is what container orchestrators, load balancers and
  uptime monitors poll.
- **NestJS `Logger`** is used for important business events (transaction
  created, stage advanced). In production a structured logger (pino,
  winston) behind `LoggerService` would be the drop-in upgrade.
- **Swagger UI at `/docs`** doubles as self-documenting API contract and
  quick debugging tool. Operators can paste a JWT and explore the
  running system without installing anything.

---

## 16. Testing Strategy

Three layers, optimised for signal per effort:

1. **Pure unit tests** on `commission-calculator` and
   `stage-transitions`. These files contain the most invariants-per-line
   in the codebase; cheap, deterministic tests are the best defense.
2. **Service-level unit tests** (`transactions.service.spec.ts`) with
   Mongoose `Model` mocked through `getModelToken`. They cover the
   orchestration rules that cannot be deduced from static types alone:
   initial stage history, forbidden stage transitions, conflict
   detection, financial breakdown side effect, and access filter shape
   by role. The mock helper `chain(resolved)` is tailored so Mongoose's
   fluent `populate/select/lean/sort/skip/limit/exec` chain can be
   expressed in a single line per test.
3. **End-to-end smoke tests** (`test/app.e2e-spec.ts`) spin up the full
   Nest app and check that `/health` answers and that `/transactions`
   rejects anonymous callers. E2E coverage is intentionally thin — deeper
   flows (login, create, advance, export) are better grown incrementally
   alongside the features that deserve them.

We deliberately do **not** ship frontend component tests yet. The UI is
thin and mostly renders stores; the payoff for setting up Vitest +
Testing Library is not worth the maintenance cost at this size.

---

## 17. Developer Experience

- **`npm run dev`** from the root fires backend + frontend via
  `concurrently` with color-coded output. No need to juggle terminals.
- **`npm run install:all`** traverses root/backend/frontend in one go
  to bootstrap a fresh clone.
- **`npm run seed`** — a deterministic way to reach a ready-to-click
  state on an empty database. Kills the "how do I get an admin?" friction.
- **`.env.example` files** on both sides make the env surface explicit
  and reviewable in PRs.
- **ESLint + Prettier** on the backend keep style drift in check.
  Test files relax the unsafe-* rules because Jest mocks unavoidably
  surface `any`; writing "correct" types for them would generate more
  noise than signal.
- **Strict TypeScript** on both sides, with explicit types on public
  function signatures. The `any` type is not used in application code —
  union types, mapped types and generics do the heavy lifting.

---

## 18. Trade-offs & Future Work

Deliberate trade-offs we made given scope:

- **Cookie is not HttpOnly.** We accept the XSS risk in exchange for a
  simpler bearer-header flow. In production you would switch to
  HttpOnly + Secure + SameSite=lax cookies and have Nuxt proxy API calls
  server-side.
- **Search is regex-based.** Good enough for hundreds of transactions;
  large datasets should move to a MongoDB text index or Atlas Search.
- **No soft delete / archival.** Transactions are append-only once
  completed, which matches the accounting mindset but would need to
  change if lifecycle management became a requirement.
- **Commission ratios are code constants.** Per-agency or per-deal
  overrides would move the constants into a settings collection with a
  per-transaction snapshot.
- **Single database for all tenants.** The current model is single-tenant.
  Multi-tenant deployments would introduce a tenant id on every document
  and every query.

Candidate next steps, ordered by value-to-effort:

- **Structured logging + request IDs** (pino, correlation headers) for
  production debuggability.
- **Dockerfile + docker-compose** (Mongo + backend + frontend) to turn
  `docker compose up` into the whole onboarding story.
- **Deployment automation** (Fly.io / Render / Vercel config in the
  repo, one-click previews).
- **Per-transaction notes and attachments** attached to each stage
  entry for a richer audit narrative.
- **Soft delete + admin-side undo** of stage advances, replacing the
  currently strict forward-only rule.

---

Questions, objections, or ideas for improvement are welcome — every
decision in this document is reversible if the business context moves.

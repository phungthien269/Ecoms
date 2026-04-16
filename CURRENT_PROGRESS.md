# CURRENT_PROGRESS.md

## 1. Session
- Session date: 2026-04-16
- Current phase: Phase 1 foundation bootstrap
- Session type: Implementation

## 2. Current Objective
Bootstrap the monorepo foundation so feature work can start on a runnable Next.js + NestJS + Prisma baseline.

## 3. Overall Status Summary
Project requirements remain stable.
Initial implementation has started.
The repository now has a runnable monorepo foundation with verified `build`, `lint`, and `typecheck`.
The baseline includes shared contracts, a Next.js storefront shell, a NestJS API shell, Docker infra, Prisma schema, and the first auth/RBAC slice.
The immediate next step is to add database migrations plus the next Phase 1 domain modules (categories, brands, shops, products).

## 4. Completed Items
- Read required skill pack from `.claude/skills/everything-claude-code`
- Re-read `PROJECT_CONTEXT.md` and `CURRENT_PROGRESS.md` before coding
- Bootstrapped workspace root:
  - `package.json` with npm workspaces
  - `turbo.json`
  - `tsconfig.base.json`
  - `.env.example`
  - `docker-compose.yml`
  - `.gitignore`, `.editorconfig`, `README.md`
- Scaffolded shared packages:
  - `packages/contracts`
  - `packages/tsconfig`
- Scaffolded `apps/web`:
  - Next.js App Router shell
  - Tailwind configuration
  - initial landing page placeholder for foundation phase
- Scaffolded `apps/api`:
  - NestJS app shell
  - global validation
  - structured success/error response helpers
  - global exception filter and response interceptor
  - health endpoint
  - placeholder auth/users/rbac modules
- Added baseline Prisma schema for:
  - users
  - shops
  - categories
  - brands
  - products
- Installed workspace dependencies successfully
- Verified workspace scripts:
  - `npm run prisma:generate`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- Implemented auth foundation:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - JWT signing and token verification
  - bcrypt password hashing
- Implemented Prisma foundation inside API:
  - global `PrismaModule`
  - `PrismaService`
- Implemented RBAC foundation:
  - `Roles` decorator
  - `RolesGuard`
  - `JwtAuthGuard`
  - `CurrentUser` decorator
- Implemented initial authenticated user surface:
  - `GET /api/users/me`

## 5. In Progress Items
- No partially implemented code slice currently open
- Next implementation target is catalog and seller foundation on top of the verified auth baseline

## 6. Next Exact Tasks
1. Add Prisma migration flow and initial seed placeholders
2. Start local PostgreSQL/Redis via Docker Compose and validate API against a real database
3. Implement category and brand modules:
   - entities
   - CRUD DTOs
   - admin APIs
4. Implement shop foundation:
   - seller shop profile
   - admin approval flow baseline
5. Implement product module baseline:
   - product CRUD
   - status handling
   - category/brand/shop relations
6. Add integration tests for auth endpoints
7. Update this file after each meaningful step

## 7. Blockers / Open Questions
- No hard blocker currently
- Still deferred until needed:
  - exact Google OAuth package choice
  - exact media provider (Cloudinary vs S3-compatible)
  - exact shared UI package scope beyond the current web shell

## 8. Recently Changed Files
- `package.json`
- `turbo.json`
- `tsconfig.base.json`
- `.env.example`
- `docker-compose.yml`
- `README.md`
- `apps/web/*`
- `apps/api/*`
- `packages/contracts/*`
- `packages/tsconfig/*`
- `prisma/schema.prisma`
- `package-lock.json`
- `CURRENT_PROGRESS.md`

## 9. Commands Run
- Read skill pack and project docs
- Inspected repository tree
- Created workspace directories for apps/packages/prisma
- `npm install`
- `npm run prisma:generate`
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `npm install` (after adding auth/JWT/ESLint dependencies)
- Re-ran `npm run typecheck`
- Re-ran `npm run lint`
- Re-ran `npm run build`

## 10. Tests Run + Result
- `npm run prisma:generate` ✅
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm run build` ✅
- No Jest test suite exists yet, so runtime business-flow tests are still pending

## 11. Bugs / Known Issues
- `rg` executable in this environment is not callable due to local access restrictions, so PowerShell file discovery is used instead
- No database container has been started yet in this session, so auth endpoints were compile-verified but not exercised against a live PostgreSQL instance
- `npm audit` currently reports 20 transitive vulnerabilities from freshly installed dependency trees; triage is pending after core foundations stabilize

## 12. Assumptions Made This Session
- Use shadcn/ui + Tailwind as the primary shared UI system
- Use PostgreSQL full-text search first
- Use modular monolith boundaries from day one
- Treat documentation files as mandatory session memory for future coding sessions
- Use `npm workspaces` + `turbo` because `pnpm` is not installed in the current environment
- Start with a minimal but future-safe Prisma schema covering foundation entities only
- Self-service registration creates `CUSTOMER` users only; seller onboarding remains an admin-approved later slice
- JWT access token only is enough for the first auth foundation slice; refresh-token flow can be added once session management requirements are implemented

## 13. Handoff Note for Next Session
The repo is now bootstrapped and verified. Do not redo scaffolding.
Resume from real database wiring and Phase 1 catalog/seller modules. The auth/JWT/RBAC baseline is already in place and compiling.

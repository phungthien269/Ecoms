# Ecoms Marketplace

Shopee-inspired marketplace monorepo built with Next.js, NestJS, PostgreSQL, Prisma, and Redis.

## Apps

- `apps/web`: customer storefront shell
- `apps/api`: modular monolith API shell

## Packages

- `packages/contracts`: shared enums and API response contracts
- `packages/tsconfig`: reusable TypeScript presets

## Local development

1. Copy `.env.example` to `.env`.
2. Start infrastructure with `docker compose up -d`.
3. Install dependencies with `npm install`.
4. Generate Prisma client with `npm run prisma:generate`.
5. Start all apps with `npm run dev`.

## Current status

Phase 1 foundation bootstrap is in progress. See `PROJECT_CONTEXT.md` and `CURRENT_PROGRESS.md`.

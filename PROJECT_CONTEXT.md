# PROJECT_CONTEXT.md

## 1. Project Overview
This project is a Shopee-inspired e-commerce marketplace built as a TypeScript full-stack system. It focuses on core marketplace business flows rather than pixel-perfect UI cloning.

Primary surfaces:
- User storefront
- Seller center
- Admin panel
- Chat system
- Notification system
- Voucher/promotion system

## 2. Primary Goals
- Clean architecture and maintainable codebase
- Modular monolith with future extractable boundaries
- Realistic e-commerce domain modeling
- Mobile-first responsive UX
- SEO-ready storefront pages
- Strong type safety and validation

## 3. Scope In
- Browse/search/filter products
- Product detail pages
- Shop pages
- Wishlist
- Cart
- Multi-shop checkout
- Voucher application
- Mock online payment + COD + mock bank transfer
- Order lifecycle and tracking timeline
- Reviews and seller replies
- Buyer-seller chat
- Seller product/order management
- Admin management dashboard
- Basic banner management
- Basic flash sale
- In-app notifications
- Email notifications for critical flows

## 4. Scope Out (Early Phases)
- Livestream
- Social feed
- Internal wallet like ShopeePay
- Affiliate / MLM system
- Loyalty coin / game mechanics
- Multi-country shipping
- Multi-currency in phase 1
- Advanced shipper dashboard

## 5. Target Similarity
Approximate Shopee similarity target: 80%

Highest-priority flows to emulate:
- Homepage structure
- Product page
- Shop page
- Browse → cart → checkout → payment → tracking

## 6. Architecture
- Architecture style: Modular Monolith
- Repo style: Monorepo
- Workspace orchestration: `npm workspaces` + `turbo`
- Principle: each module should be separable later if scale requires service extraction

## 7. Core Tech Stack
### Frontend
- Next.js 14+ App Router
- TypeScript (strict)
- Tailwind CSS
- shadcn/ui
- Zustand
- TanStack Query

### Backend
- NestJS
- REST API first
- WebSocket for chat/notifications
- class-validator + class-transformer

### Database / Infra
- PostgreSQL
- Prisma ORM
- Redis
- S3-compatible storage or Cloudinary
- Docker Compose for local dev

## 8. User Roles
- Guest
- Customer
- Seller
- Admin
- Super Admin

## 9. Role Capabilities Summary
### Guest
- Browse homepage/products/shop pages
- Search/filter products

### Customer
- Auth
- Manage profile and addresses
- Wishlist
- Cart and checkout
- Payments
- Order tracking
- Reviews
- Buyer-seller chat
- Notifications

### Seller
- Manage shop profile
- Product CRUD with variants
- Stock management
- Order management
- Voucher creation
- Chat with buyer
- View reviews
- Basic statistics

### Admin
- Manage users, sellers, shops, products, categories, brands, orders, reviews
- Manage platform vouchers, banners, basic flash sale
- Dashboard statistics
- Handle moderation/report actions

### Super Admin
- Admin capabilities plus system configuration and role/permission management

## 10. Domain Rules
### Shop / Seller
- 1 seller = 1 shop
- 1 product belongs to 1 shop
- No resale model in phase 1

### Product
Product supports:
- Name, slug, rich description
- Multiple images, optional video
- Original price, sale price
- SKU and variant SKU
- Stock
- Category (nested)
- Brand
- Variants (color, size, etc.)
- Weight and dimensions
- Tags
- Status (`DRAFT`, `ACTIVE`, `INACTIVE`, `BANNED`)
- Sold count, view count, rating average

### Cart / Checkout
- Multi-shop cart supported
- Checkout splits by shop into separate orders
- Voucher application supported by scope and type

### Payment
Supported flows:
- COD
- Mock bank transfer / QR style
- Mock online payment abstraction for future gateway integration

Rules:
- COD creates order immediately
- Online payment confirms order after success callback
- Unpaid online order timeout = 15 minutes

### Shipping
- Rule-based shipping fee (region + weight)
- Mock provider in early phase
- Shipping timeline and status history required

### Order Statuses
- `PENDING`
- `CONFIRMED`
- `PROCESSING`
- `SHIPPING`
- `DELIVERED`
- `COMPLETED`
- `CANCELLED`
- `DELIVERY_FAILED`
- `RETURN_REQUESTED`
- `RETURNED`
- `REFUNDED`

Key rules:
- Cancel before shipping
- Return request within 7 days after delivery
- Address change allowed only before seller confirmation

### Voucher Rules
Voucher types/scopes:
- Platform voucher
- Shop voucher
- Freeship voucher
- Fixed / percentage discount
- Min order, max discount, quantity limit, per-user usage limit, expiry date
- Scope by platform, shop, or category

Combination rule:
- at most 1 platform voucher + 1 shop voucher + 1 freeship voucher

### Reviews
- Verified purchase only
- 1 completed order item = 1 review opportunity
- Rating 1–5
- Text comment
- Up to 5 images
- Seller reply supported

### Chat
- Buyer-seller chat
- Realtime WebSocket
- Text + image attachments
- Product reference supported

### Notifications
- In-app realtime notifications
- Email for signup / order placed / order completed
- Categories: order status, chat, promotion

### Moderation
- Seller registration requires admin approval
- Product auto-approve with admin override/ban
- Review auto-approve with report handling
- Basic report system for product/shop/review

## 11. Suggested Module Boundaries
- auth
- users
- roles-permissions
- shops
- categories
- brands
- products
- product-media
- product-variants
- cart
- checkout
- orders
- payments
- shipping
- vouchers
- promotions
- wishlist
- reviews
- chat
- notifications
- reports-moderation
- admin-dashboard
- files-media
- shared-common

## 12. Quality / Engineering Rules
- Feature-based module structure
- Controller → Service → Repository
- Strong validation on all inputs
- Transaction-safe checkout/order/payment flows
- Global exception handling
- Structured logging
- Soft delete for important entities
- Rate limiting on public/auth-sensitive endpoints
- Proper indexing and pagination
- Explicit code over magic abstractions

## 13. Coding Conventions
- TypeScript strict mode across frontend, backend, and shared packages
- Shared contracts live in `packages/contracts`
- Shared TypeScript presets live in `packages/tsconfig`
- API responses use a structured success/error envelope
- Environment variables are centralized through `.env` and validated at boot
- Prefer explicit modules and readable service boundaries over generic abstractions

## 14. Folder Structure Summary
- `apps/web`: Next.js storefront and later seller/admin surfaces or shared web shells as needed
- `apps/api`: NestJS modular monolith API
- `packages/contracts`: shared enums, DTO-aligned contracts, API response types
- `packages/tsconfig`: reusable TypeScript configuration presets
- `prisma`: central Prisma schema and future migrations

## 15. Environment / Dependency Summary
- Runtime: Node.js 22.x
- Package manager: npm 10.x
- Local orchestration: Docker Compose
- Core services: PostgreSQL 16, Redis 7
- Frontend baseline: Next.js App Router + Tailwind CSS
- Backend baseline: NestJS + Prisma

## 16. Testing Direction
- Unit tests for critical business logic
- Integration tests for core APIs
- Prioritize cart/order/payment/review flows first

## 17. UI/UX Direction
- Inspired by Shopee, but cleaner and more modern
- Mobile-first and responsive
- Primary palette near orange/red
- Dark mode supported
- Loading, empty, and error states required

References:
- Shopee for marketplace layout
- Lazada for checkout ideas
- Tiki for clean product detail feel
- Amazon for search/filter UX
- Tokopedia for seller center inspiration

## 18. SEO / i18n / Currency
- Vietnamese + English ready
- VND only in phase 1
- Schema should not block future multi-currency
- SEO for product/category/shop pages

## 19. Scale Expectations
Target early scale:
- Users: 10,000–50,000
- Sellers: 500–2,000
- Products: 50,000–200,000
- Orders/day: 500–2,000
- Concurrent requests: 100–500

Performance priority: moderately high

## 20. Roadmap by Phase
### Phase 1 — Foundation
- Monorepo bootstrap
- Shared config
- Auth
- Users
- Roles/RBAC
- Category
- Brand
- Shop profile
- Product CRUD
- Product variants
- Media upload base

### Phase 2 — Core Commerce
- Cart
- Checkout
- Order creation
- Payment abstraction + mock payment
- Shipping fee rules
- Seller order management
- Customer order history/detail

### Phase 3 — Engagement
- Wishlist
- Reviews
- Search/filter/sort improvements
- Shop page improvements

### Phase 4 — Communication
- Chat via WebSocket
- In-app notifications
- Email notifications

### Phase 5 — Promotion
- Shop vouchers
- Platform vouchers
- Freeship vouchers
- Basic flash sale

### Phase 6 — Admin & Polish
- Admin dashboard
- Moderation/report handling
- Banner management
- Seller center polish
- Performance improvements
- More tests
- UI polish

## 21. Key Assumptions
- Default component system: shadcn/ui + Tailwind
- REST API first, not GraphQL
- PostgreSQL full-text search before any search engine integration
- One seller controls one shop in phase 1
- Marketplace behavior should favor common e-commerce conventions when not specified

## 22. Change Log (Requirements-Level)
### Initial baseline
- Requirement source consolidated from user Q&A and confirmed preferences
- Prompt language chosen: English for implementation clarity
- Project docs strategy chosen: `PROJECT_CONTEXT.md` + `CURRENT_PROGRESS.md`

### Foundation bootstrap decisions
- Monorepo execution baseline uses `npm workspaces` with `turbo`
- Shared contracts package and shared TypeScript config package are established from the start
- Prisma schema is centralized at repository root for cross-app domain visibility

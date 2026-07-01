# DOTS Daily v2 — Web Admin Portal

A Tuberculosis Treatment Monitoring System.

Built with Next.js, TypeScript, Tailwind CSS, and shadcn/ui.

## Getting Started

```bash
npm run dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to view the portal.

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form + Zod
- Axios + TanStack Query
- Laravel REST API (backend)

## Project Structure

```
web/
├── app/                  # Next.js App Router pages
│   ├── (auth)/           # Authentication route group
│   ├── (dashboard)/      # Dashboard route group
│   ├── api/              # Next.js API routes (proxy if needed)
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Landing page
│   └── globals.css       # Global styles
├── components/           # React components
│   ├── ui/               # Reusable UI primitives (shadcn)
│   ├── layout/           # Layout components (sidebar, header)
│   ├── dashboard/        # Dashboard-specific components
│   ├── tables/           # Data table components
│   ├── forms/            # Form components
│   ├── charts/           # Chart components
│   ├── shared/           # Shared domain-agnostic components
│   └── features/         # Feature-specific components
│       ├── auth/
│       ├── users/
│       ├── treatment/
│       ├── medications/
│       ├── monitoring/
│       ├── reports/
│       └── analytics/
├── hooks/                # Custom React hooks
├── lib/                  # Business logic layer
│   ├── services/         # API service functions
│   ├── store/            # State management (context/zustand)
│   ├── types/            # TypeScript interfaces and types
│   └── utils/            # Utility functions
└── public/               # Static assets
```

## Architecture Rules

- All API communication goes through Axios.
- Business logic belongs in `lib/services/`, not in components.
- Pages are thin — they only compose components.
- Components are organized by feature under `components/features/`.
- Reusable UI primitives live in `components/ui/`.

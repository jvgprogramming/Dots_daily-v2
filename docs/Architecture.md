WEB ARCHITECTURE:

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

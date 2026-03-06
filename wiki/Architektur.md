# Architecture Overview – Frontend

## Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | 18.2.0 |
| Language | TypeScript | 5.2.2 |
| Build | Vite | 6.3.5 |
| UI Library | Material-UI | 7.1.0 |
| CSS | Tailwind CSS | 3.4.1 |
| State | Redux Toolkit | 2.8.2 |
| API Fetching | RTK Query | (in Redux Toolkit) |
| 3D SDK | Matterport | 1.4.24 |
| Auth | Clerk | 4.30.7 |
| Routing | React Router DOM | 6.22.3 |

---

## Project Structure

```
src/
├── api/                   # RTK Query API definitions
│   ├── documents/         # Document endpoints
│   ├── lists/             # List endpoints
│   ├── notifications/     # Notification endpoints
│   ├── tasks/             # Task endpoints
│   └── weather/           # Weather endpoints
│
├── app/                   # Core configuration
│   ├── api.ts             # Base API configuration
│   ├── axios.ts           # Axios instance
│   └── matterport.ts      # Matterport SDK init
│
├── components/            # Reusable UI components
│   └── ui/                # Base components (Shadcn-style)
│
├── contexts/              # React contexts
│   ├── AuthContext.tsx    # Authentication context
│   ├── MatterportContext.tsx  # SDK lifecycle management
│   └── TaskContext.tsx    # Task context
│
├── features/              # Feature-based components
│   ├── calendar/          # Calendar
│   ├── dashboard/         # Dashboard
│   ├── documents/         # Document management
│   ├── list/              # List management
│   ├── mattertag/         # Matterport tags
│   ├── menu/              # Navigation
│   ├── notifications/     # Notifications
│   ├── profile/           # User profile
│   └── tasks/             # Task management
│
├── hooks/                 # Custom React hooks
├── Layouts/               # Layout components
├── store/                 # Redux store
└── types/                 # TypeScript type definitions
```

---

## Data Flow

```
User Action
    │
    ▼
React Component
    │
    ├──► Redux Store (local state)
    │         │
    │         ▼
    │    RTK Query / Axios
    │         │
    │         ▼
    │    Backend API
    │
    └──► Matterport SDK (3D interaction)
```

---

## Key Design Decisions

1. **Feature-based architecture**: Each feature has its own components, hooks and API calls
2. **RTK Query**: Automatic caching and cache invalidation for server data
3. **Matterport Context**: SDK lifecycle is managed centrally in the context
4. **Clerk**: Authentication delegated to SaaS solution

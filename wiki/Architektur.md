# Architektur-Übersicht – Frontend

## Technologie-Stack

| Kategorie | Technologie | Version |
|-----------|------------|---------|
| Framework | React | 18.2.0 |
| Sprache | TypeScript | 5.2.2 |
| Build | Vite | 6.3.5 |
| UI-Library | Material-UI | 7.1.0 |
| CSS | Tailwind CSS | 3.4.1 |
| State | Redux Toolkit | 2.8.2 |
| API-Fetching | RTK Query | (in Redux Toolkit) |
| 3D-SDK | Matterport | 1.4.24 |
| Auth | Clerk | 4.30.7 |
| Routing | React Router DOM | 6.22.3 |

---

## Projektstruktur

```
src/
├── api/                   # RTK Query API-Definitionen
│   ├── documents/         # Dokument-Endpunkte
│   ├── lists/             # Listen-Endpunkte
│   ├── notifications/     # Benachrichtigungs-Endpunkte
│   ├── tasks/             # Task-Endpunkte
│   └── weather/           # Wetter-Endpunkte
│
├── app/                   # Core-Konfiguration
│   ├── api.ts             # Basis-API-Konfiguration
│   ├── axios.ts           # Axios-Instanz
│   └── matterport.ts      # Matterport SDK-Init
│
├── components/            # Wiederverwendbare UI-Komponenten
│   └── ui/                # Basis-Komponenten (Shadcn-Style)
│
├── contexts/              # React-Kontexte
│   ├── AuthContext.tsx    # Authentifizierungs-Kontext
│   ├── MatterportContext.tsx  # SDK-Lifecycle-Management
│   └── TaskContext.tsx    # Aufgaben-Kontext
│
├── features/              # Feature-basierte Komponenten
│   ├── calendar/          # Kalender
│   ├── dashboard/         # Dashboard
│   ├── documents/         # Dokumentenverwaltung
│   ├── list/              # Listen-Management
│   ├── mattertag/         # Matterport-Tags
│   ├── menu/              # Navigation
│   ├── notifications/     # Benachrichtigungen
│   ├── profile/           # Nutzerprofil
│   └── tasks/             # Aufgabenverwaltung
│
├── hooks/                 # Custom React Hooks
├── Layouts/               # Layout-Komponenten
├── store/                 # Redux Store
└── types/                 # TypeScript-Typdefinitionen
```

---

## Datenfluss

```
Nutzeraktion
    │
    ▼
React-Komponente
    │
    ├──► Redux Store (lokaler State)
    │         │
    │         ▼
    │    RTK Query / Axios
    │         │
    │         ▼
    │    Backend-API
    │
    └──► Matterport SDK (3D-Interaktion)
```

---

## Key Design Decisions

1. **Feature-basierte Architektur**: Jedes Feature hat eigene Komponenten, Hooks und API-Calls
2. **RTK Query**: Automatisches Caching und Cache-Invalidierung für Server-Daten
3. **Matterport Context**: SDK-Lifecycle wird zentral im Context verwaltet
4. **Clerk**: Authentifizierung ausgelagert an SaaS-Lösung

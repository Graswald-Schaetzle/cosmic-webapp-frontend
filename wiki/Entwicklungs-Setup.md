# Entwicklungs-Setup – Frontend

## Voraussetzungen

- Node.js 18+ ([Download](https://nodejs.org))
- npm oder yarn

## Installation

```bash
# Repository klonen
git clone https://github.com/Graswald-Schaetzle/cosmic-webapp-frontend.git
cd cosmic-webapp-frontend

# Abhängigkeiten installieren
npm install
```

## Umgebungsvariablen

Erstelle eine `.env`-Datei im Root-Verzeichnis:

```env
# Matterport
VITE_MATTERPORT_KEY=dein_matterport_api_key
VITE_MATTERPORT_MODEL_ID=dein_matterport_model_id

# Authentifizierung (Clerk)
VITE_CLERK_PUBLISHABLE_KEY=dein_clerk_publishable_key

# Wetter-API
VITE_OPENWEATHER_API_KEY=dein_openweather_api_key

# Backend-URL
VITE_API_BASE_URL=http://localhost:4000
```

## Entwicklungsserver starten

```bash
npm run dev
# → Öffnet http://localhost:5173
```

## Verfügbare Scripts

```bash
npm run dev          # Entwicklungsserver
npm run build        # Production Build
npm run preview      # Production Build vorschauen
npm run lint         # ESLint ausführen
npm run type-check   # TypeScript prüfen
npm run format       # Prettier formatieren
```

## Backend verbinden

Das Frontend benötigt das laufende Backend:
→ Siehe [cosmic-backend Setup](https://github.com/Graswald-Schaetzle/cosmic-backend/wiki)

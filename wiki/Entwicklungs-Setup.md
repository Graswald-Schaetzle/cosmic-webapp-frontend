# Development Setup – Frontend

## Prerequisites

- Node.js 18+ ([Download](https://nodejs.org))
- npm or yarn

## Installation

```bash
# Clone the repository
git clone https://github.com/Graswald-Schaetzle/cosmic-webapp-frontend.git
cd cosmic-webapp-frontend

# Install dependencies
npm install
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Matterport
VITE_MATTERPORT_KEY=your_matterport_api_key
VITE_MATTERPORT_MODEL_ID=your_matterport_model_id

# Authentication (Clerk)
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Weather API
VITE_OPENWEATHER_API_KEY=your_openweather_api_key

# Backend URL
VITE_API_BASE_URL=http://localhost:4000
```

## Start Development Server

```bash
npm run dev
# → Opens http://localhost:5173
```

## Available Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
npm run format       # Format with Prettier
```

## Connect to Backend

The frontend requires the backend to be running:
→ See [cosmic-backend Setup](https://github.com/Graswald-Schaetzle/cosmic-backend/wiki)

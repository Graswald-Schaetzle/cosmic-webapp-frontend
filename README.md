```
 ██████╗  ██████╗   ██████╗ ███╗   ███╗ ██╗  ██████╗
██╔════╝ ██╔═══██╗ ██╔════╝ ████╗ ████║ ██║ ██╔════╝
██║      ██║   ██║ ╚█████╗  ██╔████╔██║ ██║ ██║
██║      ██║   ██║  ╚═══██╗ ██║╚██╔╝██║ ██║ ██║
╚██████╗ ╚██████╔╝ ██████╔╝ ██║ ╚═╝ ██║ ██║ ╚██████╗
 ╚═════╝  ╚═════╝  ╚═════╝  ╚═╝     ╚═╝ ╚═╝  ╚═════╝
 ```
 # 🌌 Cosmic Web Application

A modern, immersive web application that combines 3D Matterport visualization with comprehensive task and document management. Built with React, TypeScript, and cutting-edge web technologies.

![Cosmic Web App](https://img.shields.io/badge/React-18.2.0-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2.2-blue?style=for-the-badge&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6.3.5-purple?style=for-the-badge&logo=vite)
![Matterport](https://img.shields.io/badge/Matterport-SDK-1.4.24-green?style=for-the-badge)

## 🚀 Features

- **3D Matterport Integration**: Immersive 3D model visualization with interactive mattertags
- **Task Management**: Comprehensive task creation, editing, and organization with lists
- **Document Management**: Upload, view, and manage documents with PDF support
- **Real-time Notifications**: Instant notifications for all user actions
- **User Authentication**: Secure authentication with Clerk
- **Weather Integration**: Real-time weather data for locations
- **Responsive Design**: Modern UI with Material-UI and Tailwind CSS
- **Drag & Drop**: Intuitive drag-and-drop functionality for task organization

## 🏗️ Project Structure

```
cosmic-webapp-fe-22.05/
├── src/
│   ├── api/                    # API integration layer
│   │   ├── documents/          # Document API endpoints
│   │   ├── lists/             # Lists API endpoints
│   │   ├── locationApi/       # Location API endpoints
│   │   ├── notifications/     # Notification API endpoints
│   │   ├── tasks/             # Task API endpoints
│   │   ├── userMenu/          # User menu API endpoints
│   │   └── weather/           # Weather API endpoints
│   ├── app/                   # Core application utilities
│   │   ├── api.ts            # Base API configuration
│   │   ├── axios.ts          # Axios instance setup
│   │   ├── matterport.ts     # Matterport SDK integration
│   │   └── utils.ts          # Utility functions
│   ├── components/            # Reusable UI components
│   │   ├── ui/               # Base UI components
│   │   ├── Dialog.tsx        # Modal dialog component
│   │   └── ConfirmDeletionModal.tsx
│   ├── contexts/             # React context providers
│   │   ├── AuthContext.tsx   # Authentication context
│   │   ├── MatterportContext.tsx # Matterport SDK context
│   │   └── TaskContext.tsx   # Task management context
│   ├── features/             # Feature-based components
│   │   ├── calendar/         # Calendar functionality
│   │   ├── dashboard/        # Dashboard components
│   │   ├── documents/        # Document management
│   │   ├── list/            # List management
│   │   ├── mattertag/       # Matterport tag components
│   │   ├── menu/            # Navigation menu
│   │   ├── notifications/   # Notification system
│   │   ├── objectManager/   # Object management
│   │   ├── profile/         # User profile
│   │   └── tasks/           # Task management
│   ├── hooks/               # Custom React hooks
│   ├── Layouts/             # Layout components
│   │   ├── Layout/          # Main application layout
│   │   └── MatterportLayout/ # Matterport-specific layout
│   ├── store/               # Redux store configuration
│   │   ├── modalSlice.ts    # Modal state management
│   │   ├── locationsSlice.ts # Location state management
│   │   └── store.ts         # Redux store setup
│   ├── styles/              # Global styles
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Utility functions
├── public/                  # Static assets
│   ├── icons/              # SVG icons
│   ├── img/                # Images
│   └── pdf-worker/         # PDF.js worker files
└── docs/                   # Documentation
```

## 🛠️ Tech Stack

### **Frontend Framework**
- **React 18.2.0** - Modern React with hooks and concurrent features
- **TypeScript 5.2.2** - Type-safe JavaScript development
- **Vite 6.3.5** - Fast build tool and development server

### **UI & Styling**
- **Material-UI (MUI) 7.1.0** - React component library
- **Tailwind CSS 3.4.1** - Utility-first CSS framework
- **Emotion** - CSS-in-JS styling solution
- **Radix UI** - Accessible UI primitives

### **State Management**
- **Redux Toolkit 2.8.2** - Modern Redux with RTK Query
- **React Redux 9.2.0** - React bindings for Redux

### **3D Visualization**
- **Matterport SDK 1.4.24** - 3D model integration
- **Custom Matterport Context** - React context for SDK management

### **Authentication & Security**
- **Clerk 4.30.7** - Modern authentication solution
- **Secure token management** - JWT-based authentication

### **Data Fetching & API**
- **RTK Query** - Powerful data fetching and caching
- **Axios 1.9.0** - HTTP client for API requests

### **Additional Libraries**
- **React Router DOM 6.22.3** - Client-side routing
- **React DnD 16.0.1** - Drag and drop functionality
- **React PDF 6.2.2** - PDF viewing capabilities
- **Date-fns 2.30.0** - Date manipulation utilities
- **Day.js 1.11.13** - Lightweight date library

## 🧠 Application Logic

### **Core Architecture**
The application follows a **feature-based architecture** with clear separation of concerns:

1. **API Layer**: Centralized API management with RTK Query
2. **State Management**: Redux store with slices for different domains
3. **Context Providers**: React contexts for global state (auth, matterport, tasks)
4. **Feature Components**: Organized by business domains
5. **UI Components**: Reusable components with Material-UI

### **Key Features Logic**

#### **Matterport Integration**
- **SDK Initialization**: Custom React context manages Matterport SDK lifecycle
- **Tag Management**: Interactive mattertags with custom data and actions
- **3D Navigation**: Seamless integration between 3D space and 2D UI

#### **Task Management**
- **Multi-List Support**: Tasks can belong to multiple lists
- **Real-time Updates**: Live editing with immediate UI feedback
- **Notification System**: Automatic notifications for all task actions
- **Drag & Drop**: Intuitive task organization

#### **Document Management**
- **PDF Support**: Full PDF viewing and annotation capabilities
- **File Upload**: Secure file upload with progress tracking
- **Document Linking**: Link documents to specific locations/tasks

#### **Notification System**
- **Real-time Updates**: Instant notifications for user actions
- **Location-based**: Notifications tied to specific locations
- **Activity Tracking**: Comprehensive activity logging

## 🚀 Getting Started

### **First Time Setup**

1. **Clone the repository**
   ```bash
   git clone https://gitlab.com/aestar/de-cosmic-webapp.git
   cd de-cosmic-webapp
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   # Matterport Configuration
   VITE_MATTERPORT_KEY=your_matterport_api_key
   VITE_MATTERPORT_MODEL_ID=your_matterport_model_id
   
   # Authentication
   VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   
   # Weather API
   VITE_OPENWEATHER_API_KEY=your_openweather_api_key
   ```

4. **Start development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

### **Everyday Launch**

1. **Navigate to project directory**
   ```bash
   cd cosmic-webapp-fe-22.05
   ```

2. **Start development server**
   ```bash
   npm run dev
   ```

3. **Access the application**
   Open `http://localhost:3000` in your browser

## 📜 Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
npm run format       # Format code with Prettier
npm run format:check # Check code formatting
```

## 🔧 Development Workflow

### **Code Organization**
- **Feature-based structure**: Each feature has its own directory
- **Shared components**: Reusable components in `/components`
- **Type safety**: Comprehensive TypeScript definitions
- **API integration**: Centralized API management with RTK Query

### **State Management**
- **Redux Toolkit**: Modern Redux with RTK Query for API calls
- **React Context**: Global state for authentication and Matterport
- **Local State**: Component-level state with React hooks

### **Styling Approach**
- **Material-UI**: Primary component library
- **Tailwind CSS**: Utility classes for custom styling
- **Emotion**: CSS-in-JS for dynamic styles
- **Responsive Design**: Mobile-first approach

## 🌐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_MATTERPORT_KEY` | Matterport API key for 3D visualization | ✅ |
| `VITE_MATTERPORT_MODEL_ID` | Your Matterport 3D model ID | ✅ |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk authentication key | ✅ |
| `VITE_OPENWEATHER_API_KEY` | OpenWeather API key for weather data | ✅ |

## 🐛 Troubleshooting

### **Common Issues**

1. **Matterport SDK not loading**
   - Check `VITE_MATTERPORT_KEY` and `VITE_MATTERPORT_MODEL_ID`
   - Ensure network connectivity to Matterport servers

2. **Authentication issues**
   - Verify `VITE_CLERK_PUBLISHABLE_KEY` is correct
   - Check Clerk dashboard for configuration

3. **Build errors**
   - Run `npm run type-check` to identify TypeScript issues
   - Ensure all dependencies are installed with `npm install`

### **Development Tips**

- Use `npm run type-check` before committing to catch TypeScript errors
- Run `npm run format` to maintain consistent code formatting
- Check browser console for detailed error messages
- Use React DevTools for component debugging

## 📦 Production Deployment

### **Build Process**
```bash
npm run build
```

### **Docker Support**
The project includes Docker configuration for containerized deployment:
```bash
docker-compose up --build -d
```
]

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## Developed by Nikita Chornyi

*Building immersive digital experiences with cutting-edge web technologies*

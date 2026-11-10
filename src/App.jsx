import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { EditorProvider } from './context/EditorContext';
import { ToastProvider } from './context/ToastContext';

import { ProtectedRoute } from './components/ProtectedRoute';
import MobileOverlay from './components/UI/MobileOverlay';
import ConnectingScreen from './components/UI/ConnectingScreen';

import { ThemeProvider } from 'next-themes';

const Login = lazy(() => import('./pages/Login/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Workspace = lazy(() => import('./pages/Workspace/Workspace'));
const Tasks = lazy(() => import('./pages/Tasks/Tasks'));
const NoteEditor = lazy(() => import('./components/Editor/NoteEditor'));
const AIChat = lazy(() => import('./components/Chat/AIChat'));

const RouteLoader = () => <ConnectingScreen />;

const ContentLoader = () => (
  <div className="flex-1 w-full h-full flex items-center justify-center bg-[var(--c-surface)] text-neutral-400">
    <div className="w-5 h-5 border-2 border-black/10 dark:border-white/10 border-t-black/60 dark:border-t-white/60 rounded-full animate-spin" />
  </div>
);

const DashboardIndex = () => {
  const mode = localStorage.getItem('noema-chat-startup-mode') || 'resume';
  if (mode === 'resume') {
    const savedRoute = localStorage.getItem('noema-last-route');
    if (savedRoute && savedRoute.startsWith('/dashboard/') && savedRoute !== '/dashboard') {
      return <Navigate to={savedRoute} replace />;
    }
  }
  return <Navigate to="/dashboard/page/new" replace />;
};

const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <Suspense fallback={<RouteLoader />}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <Suspense fallback={<RouteLoader />}>
          <Dashboard />
        </Suspense>
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardIndex />,
      },
      {
        path: "chat",
        element: (
          <Suspense fallback={<ContentLoader />}>
            <AIChat />
          </Suspense>
        ),
      },
      {
        path: "page/:pageId",
        element: (
          <Suspense fallback={<ContentLoader />}>
            <NoteEditor />
          </Suspense>
        ),
      },
      {
        path: "workspace/:workspaceId",
        element: <Navigate to="/dashboard/page/new" replace />,
      },
      {
        path: "tasks",
        element: (
          <Suspense fallback={<ContentLoader />}>
            <Tasks />
          </Suspense>
        ),
      },
    ],
  },
  { path: "/", element: <Navigate to="/dashboard/page/new" replace /> },
  { path: "*", element: <Navigate to="/dashboard/page/new" replace /> },
]);

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <GoogleOAuthProvider clientId={import.meta.env.Config_GOOGLE_CLIENT_ID}>
        <ToastProvider>
          <AuthProvider>
            <ChatProvider>
              <EditorProvider>
                <MobileOverlay />
                <RouterProvider router={router} />
              </EditorProvider>
            </ChatProvider>
          </AuthProvider>
        </ToastProvider>
      </GoogleOAuthProvider>
    </ThemeProvider>
  )
}

export default App;

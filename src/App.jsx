import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import NavigationTracker from '@/lib/NavigationTracker';
import { pagesConfig } from './pages.config';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

// Pages that should not have layout
const noLayoutPages = ['Login', 'RoleSelection'];

// Define page access by role
const pageAccess = {
  // Technician-only pages
  technician: [
    'TechnicianHome',
    'TechnicianDashboard',
    'TechnicianJobs',
    'TechnicianNavigation',
    'TechnicianProfile',
    'TechnicianEquipment',
    'JobDetails',
    'JobExecution'
  ],
  // Admin/Supervisor pages
  admin: [
    'AdminDashboard',
    'ServiceRequests',
    'Calendar',
    'LiveTracking',
    'WorkReports',
    'Reports',
    'Technicians',
    'Clients',
    'EquipmentInventory',
    'Scheduling',
    'Settings',
    'Messages',
    'JobDetails' // Admins can view job details
  ],
  supervisor: [
    'AdminDashboard',
    'ServiceRequests',
    'Calendar',
    'LiveTracking',
    'WorkReports',
    'Reports',
    'Technicians',
    'Clients',
    'EquipmentInventory',
    'Scheduling',
    'Settings',
    'Messages',
    'JobDetails'
  ],
  // Client pages
  client: [
    'ClientDashboard',
    'JobDetails' // Clients can view their own job details
  ]
};

// Get default redirect path for a role
const getDefaultPathForRole = (role) => {
  if (role === "technician") return "/TechnicianHome";
  if (role === "admin" || role === "supervisor") return "/AdminDashboard";
  if (role === "client") return "/ClientDashboard";
  return "/RoleSelection";
};

// Protected Route Component
const ProtectedRoute = ({ pageName, children }) => {
  const { user, isLoadingAuth } = useAuth();

  // Show loading while checking auth
  if (isLoadingAuth || !user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Get user role from metadata
  const userRole = user?.user_metadata?.user_role;

  // If user is authenticated and tries to open Login or RoleSelection (e.g. via back button), redirect to role default
  if (pageName === 'Login' || pageName === 'RoleSelection') {
    const redirectPath = getDefaultPathForRole(userRole);
    return <Navigate to={redirectPath} replace />;
  }

  // Check if user has access to this page
  const allowedPages = pageAccess[userRole] || [];
  const hasAccess = allowedPages.includes(pageName);

  // If no access, redirect to role-appropriate page
  if (!hasAccess) {
    const redirectPath = getDefaultPathForRole(userRole);
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

const LayoutWrapper = ({ children, currentPageName }) => {
  // Don't apply layout to certain pages
  if (noLayoutPages.includes(currentPageName)) {
    return <>{children}</>;
  }
  return Layout ?
    <Layout data-source-location="App:16:2" data-dynamic-content="true" currentPageName={currentPageName}>{children}</Layout> :
    <>{children}</>;
};

// Component to handle role-based redirect
const RoleBasedRedirect = () => {
  const { user, isLoadingAuth } = useAuth();

  // Show loading while checking auth
  if (isLoadingAuth || !user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Get user role from metadata
  const userRole = user?.user_metadata?.user_role;

  // Redirect based on role
  const redirectPath = getDefaultPathForRole(userRole);
  return <Navigate to={redirectPath} replace />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, authError } = useAuth();

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
    return (
      <div data-source-location="App:25:6" data-dynamic-content="false" className="fixed inset-0 flex items-center justify-center">
        <div data-source-location="App:26:8" data-dynamic-content="false" className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>);
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Pages.Login />} />
        <Route path="*" element={<Pages.Login />} />
      </Routes>
    );
  }

  // Render the main app for authenticated users
  return (
    <Routes data-source-location="App:44:4" data-dynamic-content="true">
      {/* Redirect root path based on user role */}
      <Route data-source-location="App:45:6" data-dynamic-content="false" path="/" element={<RoleBasedRedirect />} />
      {Object.entries(Pages).map(([path, Page]) =>
      <Route data-source-location="App:51:8" data-dynamic-content="false"
      key={path}
      path={`/${path}`}
      element={
      <ProtectedRoute pageName={path}>
        <LayoutWrapper data-source-location="App:55:12" data-dynamic-content="false" currentPageName={path}>
              <Page data-source-location="App:56:14" data-dynamic-content="false" />
            </LayoutWrapper>
      </ProtectedRoute>
      } />

      )}
      <Route data-source-location="App:61:6" data-dynamic-content="false" path="*" element={<PageNotFound data-source-location="App:61:31" data-dynamic-content="false" />} />
    </Routes>);

};


function App() {

  return (
    <AuthProvider data-source-location="App:70:4" data-dynamic-content="true">
      <QueryClientProvider data-source-location="App:71:6" data-dynamic-content="false" client={queryClientInstance}>
        <Router data-source-location="App:72:8" data-dynamic-content="false">
          <NavigationTracker data-source-location="App:73:10" data-dynamic-content="false" />
          <AuthenticatedApp data-source-location="App:74:10" data-dynamic-content="false" />
        </Router>
        <Toaster data-source-location="App:76:8" data-dynamic-content="false" />
        <SonnerToaster position="top-right" richColors />
      </QueryClientProvider>
    </AuthProvider>);

}

export default App;
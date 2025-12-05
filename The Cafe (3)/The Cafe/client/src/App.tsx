import { Route, Switch, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { getAuthState, setAuthState, subscribeToAuth, getCurrentUser } from "./lib/auth";
import Login from "@/pages/login";
import Setup from "@/pages/setup";
import Dashboard from "@/pages/dashboard";
import Schedule from "@/pages/schedule";
import ShiftTrading from "@/pages/shift-trading";
import Payroll from "@/pages/payroll";
import Notifications from "@/pages/notifications";
import Employees from "@/pages/employees";
import Branches from "@/pages/branches";
import Reports from "@/pages/reports";
import PayrollManagement from "@/pages/payroll-management";
import HoursReport from "@/pages/hours-report";
import DeductionSettings from "@/pages/deduction-settings";
import AdminDeductionRates from "@/pages/admin-deduction-rates";
import MobileDashboard from "@/pages/mobile-dashboard";
import MobileSchedule from "@/pages/mobile-schedule";
import MobilePayroll from "@/pages/mobile-payroll";
import MobileNotifications from "@/pages/mobile-notifications";
import MobileTimeOff from "@/pages/mobile-time-off";
import MobileShiftTrading from "@/pages/mobile-shift-trading";
import MobileShiftDrop from "@/pages/mobile-shift-drop";
import MobileProfile from "@/pages/mobile-profile";
import MobileMore from "@/pages/mobile-more";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import NotFound from "@/pages/not-found";
import { apiRequest } from "./lib/queryClient";
import { Coffee } from "lucide-react";

// Role-based component wrappers (only used on desktop server)
function ScheduleWrapper() {
  const { user, isAuthenticated } = getAuthState();

  // Wait for authentication to load
  if (!isAuthenticated || !user) {
    return <div>Loading...</div>;
  }

  // On desktop server, always show desktop version
  return <Schedule />;
}

function PayrollWrapper() {
  const { user, isAuthenticated } = getAuthState();

  // Wait for authentication to load
  if (!isAuthenticated || !user) {
    return <div>Loading...</div>;
  }

  // On desktop server, always show desktop version
  return <Payroll />;
}

function NotificationsWrapper() {
  const { user, isAuthenticated } = getAuthState();

  // Wait for authentication to load
  if (!isAuthenticated || !user) {
    return <div>Loading...</div>;
  }

  // On desktop server, always show desktop version
  return <Notifications />;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const logoPath = '/LOGO.png';
  const fallbackLogoPath = '/images/LOGO.png';
  const [logoToUse, setLogoToUse] = useState(logoPath);
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Try to load the logo and fallback if needed
  useEffect(() => {
    const img = new Image();

    img.onload = () => {
      setLogoLoaded(true);
    };

    img.onerror = () => {
      console.error(`❌ Failed to load logo from: ${logoToUse}`);
      if (logoToUse === logoPath) {
        setLogoToUse(fallbackLogoPath);
      }
    };

    img.src = logoToUse;
    
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [logoToUse]);

  return (
    <div className="flex h-screen bg-background relative">
      {/* Background with logo */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -10,
        backgroundColor: 'rgba(255, 255, 255, 0.95)', // Slightly off-white background
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <img 
          src={logoToUse}
          alt="" 
          style={{
            maxWidth: '60%',
            maxHeight: '60%',
            objectFit: 'contain',
            opacity: logoLoaded ? 0.15 : 0, // Subtle logo visibility
            transition: 'opacity 0.5s ease-in-out',
          }}
          onError={() => {
            if (logoToUse === logoPath) {
              setLogoToUse(fallbackLogoPath);
            }
          }}
        />
      </div>
      
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background/80">
          {children}
        </main>
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated } = getAuthState();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Switch>
      <Route path="/">
        {window.location.port === '5001' ? (
          <Redirect to="/mobile-dashboard" />
        ) : (
          <AuthenticatedLayout>
            <Dashboard />
          </AuthenticatedLayout>
        )}
      </Route>
      <Route path="/schedule">
        {window.location.port === '5001' ? (
          <MobileSchedule />
        ) : (
          <AuthenticatedLayout>
            <ScheduleWrapper />
          </AuthenticatedLayout>
        )}
      </Route>
      <Route path="/shift-trading">
        <AuthenticatedLayout>
          <ShiftTrading />
        </AuthenticatedLayout>
      </Route>
      <Route path="/payroll">
        {window.location.port === '5001' ? (
          <MobilePayroll />
        ) : (
          <AuthenticatedLayout>
            <PayrollWrapper />
          </AuthenticatedLayout>
        )}
      </Route>
      <Route path="/notifications">
        {window.location.port === '5001' ? (
          <MobileNotifications />
        ) : (
          <AuthenticatedLayout>
            <NotificationsWrapper />
          </AuthenticatedLayout>
        )}
      </Route>
      <Route path="/employees">
        <AuthenticatedLayout>
          <Employees />
        </AuthenticatedLayout>
      </Route>
      <Route path="/reports">
        <AuthenticatedLayout>
          <Reports />
        </AuthenticatedLayout>
      </Route>
      <Route path="/branches">
        <AuthenticatedLayout>
          <Branches />
        </AuthenticatedLayout>
      </Route>
      <Route path="/payroll-management">
        <AuthenticatedLayout>
          <PayrollManagement />
        </AuthenticatedLayout>
      </Route>
      <Route path="/hours-report">
        <AuthenticatedLayout>
          <HoursReport />
        </AuthenticatedLayout>
      </Route>
      <Route path="/deduction-settings">
        <AuthenticatedLayout>
          <DeductionSettings />
        </AuthenticatedLayout>
      </Route>
      <Route path="/admin/deduction-rates">
        <AuthenticatedLayout>
          <AdminDeductionRates />
        </AuthenticatedLayout>
      </Route>
      {window.location.port === '5001' && (
        <>
          <Route path="/mobile-dashboard">
            <MobileDashboard />
          </Route>
          <Route path="/mobile-schedule">
            <MobileSchedule />
          </Route>
          <Route path="/mobile-payroll">
            <MobilePayroll />
          </Route>
          <Route path="/mobile-notifications">
            <MobileNotifications />
          </Route>
          <Route path="/mobile-time-off">
            <MobileTimeOff />
          </Route>
          <Route path="/mobile-shift-trading">
            <MobileShiftTrading />
          </Route>
          <Route path="/mobile-shift-drop">
            <MobileShiftDrop />
          </Route>
          <Route path="/mobile-profile">
            <MobileProfile />
          </Route>
          <Route path="/mobile-more">
            <MobileMore />
          </Route>
        </>
      )}
      <Route>
        <AuthenticatedLayout>
          <NotFound />
        </AuthenticatedLayout>
      </Route>
    </Switch>
  );
}

function App() {
  const [authState, setLocalAuthState] = useState(getAuthState());
  const [isLoading, setIsLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);

  useEffect(() => {
    // Check setup status and authentication
    const checkSetupAndAuth = async () => {
      setIsLoading(true);
      try {
        // First check if setup is complete
        const setupResponse = await apiRequest("GET", "/api/setup/status");
        const setupData = await setupResponse.json();
        setSetupComplete(setupData.isSetupComplete);

        // If setup is complete, check authentication
        if (setupData.isSetupComplete) {
          try {
            const authResponse = await apiRequest("GET", "/api/auth/me");
            const authData = await authResponse.json();
            setAuthState({ user: authData.user, isAuthenticated: true });
          } catch (error) {
            // User is not authenticated
            setAuthState({ user: null, isAuthenticated: false });
          }
        }
      } catch (error) {
        console.error('Setup/Auth check error:', error);
        // Assume setup is not complete if we can't check
        setSetupComplete(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSetupAndAuth();

    // Subscribe to auth state changes
    const unsubscribe = subscribeToAuth(setLocalAuthState);
    return () => {
      unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative">
        {/* Logo Background for Login - Centered */}
        <div className="fixed inset-0 -z-10 opacity-10">
          <div className="h-full w-full">
            <img
              src="/LOGO.png"
              alt="Logo"
              className="w-auto h-auto max-w-[80%] max-h-[80%] object-contain"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          </div>
        </div>
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <Coffee className="h-8 w-8 text-primary-foreground animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If setup is not complete, show setup wizard
  if (setupComplete === false) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Setup />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

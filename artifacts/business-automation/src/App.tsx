import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { Layout } from "./components/layout";
import NotFound from "@/pages/not-found";

// Pages
import Login from "./pages/login";
import ForgotPassword from "./pages/forgot-password";
import ResetPassword from "./pages/reset-password";
import Dashboard from "./pages/dashboard";
import Profile from "./pages/profile";
import Organizations from "./pages/organizations";
import Users from "./pages/users";
import Departments from "./pages/departments";
import Attendance from "./pages/attendance";
import Projects from "./pages/projects";
import Billing from "./pages/billing";
import Marketing from "./pages/marketing";
import Analytics from "./pages/analytics";
import Clients from "./pages/clients";
import Bills from "./pages/bills";
import Calendar from "./pages/calendar";
import Finance from "./pages/finance";
import Inventory from "./pages/inventory";
import Documents from "./pages/documents";
import DigitalMarketing from "./pages/digital-marketing";
import Audit from "./pages/audit";
import Reports from "./pages/reports";
import Settings from "./pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});

function ProtectedRoute({ component: Component, allowedRoles }: { component: any; allowedRoles?: string[] }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-slate-400 text-sm">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="p-10 text-center">
        <div className="max-w-sm mx-auto mt-20">
          <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Access Denied</h2>
          <p className="text-slate-500 text-sm">You don't have permission to view this page. Contact your administrator if you think this is an error.</p>
        </div>
      </div>
    );
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />

      <Route path="/">
        <Layout><ProtectedRoute component={Dashboard} /></Layout>
      </Route>

      <Route path="/profile">
        <Layout><ProtectedRoute component={Profile} /></Layout>
      </Route>

      <Route path="/organizations">
        <Layout><ProtectedRoute component={Organizations} allowedRoles={["super_admin"]} /></Layout>
      </Route>

      <Route path="/users">
        <Layout><ProtectedRoute component={Users} allowedRoles={["super_admin", "org_admin", "department_head"]} /></Layout>
      </Route>

      <Route path="/departments">
        <Layout><ProtectedRoute component={Departments} allowedRoles={["super_admin", "org_admin"]} /></Layout>
      </Route>

      <Route path="/attendance">
        <Layout><ProtectedRoute component={Attendance} /></Layout>
      </Route>

      <Route path="/projects">
        <Layout><ProtectedRoute component={Projects} /></Layout>
      </Route>

      <Route path="/billing">
        <Layout><ProtectedRoute component={Billing} allowedRoles={["super_admin", "org_admin"]} /></Layout>
      </Route>

      <Route path="/marketing">
        <Layout><ProtectedRoute component={Marketing} allowedRoles={["super_admin", "org_admin"]} /></Layout>
      </Route>

      <Route path="/analytics">
        <Layout><ProtectedRoute component={Analytics} allowedRoles={["super_admin", "org_admin", "department_head"]} /></Layout>
      </Route>

      <Route path="/clients">
        <Layout><ProtectedRoute component={Clients} allowedRoles={["super_admin", "org_admin", "department_head"]} /></Layout>
      </Route>

      <Route path="/bills">
        <Layout><ProtectedRoute component={Bills} allowedRoles={["super_admin", "org_admin"]} /></Layout>
      </Route>

      <Route path="/calendar">
        <Layout><ProtectedRoute component={Calendar} /></Layout>
      </Route>

      <Route path="/finance">
        <Layout><ProtectedRoute component={Finance} allowedRoles={["super_admin", "org_admin"]} /></Layout>
      </Route>

      <Route path="/inventory">
        <Layout><ProtectedRoute component={Inventory} allowedRoles={["super_admin", "org_admin", "department_head"]} /></Layout>
      </Route>

      <Route path="/documents">
        <Layout><ProtectedRoute component={Documents} /></Layout>
      </Route>

      <Route path="/digital-marketing">
        <Layout><ProtectedRoute component={DigitalMarketing} allowedRoles={["super_admin", "org_admin"]} /></Layout>
      </Route>

      <Route path="/audit">
        <Layout><ProtectedRoute component={Audit} allowedRoles={["super_admin", "org_admin"]} /></Layout>
      </Route>

      <Route path="/reports">
        <Layout><ProtectedRoute component={Reports} allowedRoles={["super_admin", "org_admin", "department_head"]} /></Layout>
      </Route>

      <Route path="/settings">
        <Layout><ProtectedRoute component={Settings} /></Layout>
      </Route>

      <Route>
        <Layout><NotFound /></Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

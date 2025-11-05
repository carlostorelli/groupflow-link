import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import WhatsApp from "./pages/WhatsApp";
import Groups from "./pages/Groups";
import RedirectLink from "./pages/RedirectLink";
import Jobs from "./pages/Jobs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <SidebarProvider>
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  </SidebarProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/whatsapp"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <WhatsApp />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/groups"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Groups />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/redirect"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <RedirectLink />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/jobs"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Jobs />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

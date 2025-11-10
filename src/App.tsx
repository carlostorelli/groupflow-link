import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "next-themes";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import WhatsApp from "./pages/WhatsApp";
import Groups from "./pages/Groups";
import RedirectLink from "./pages/RedirectLink";
import Jobs from "./pages/Jobs";
import ContactExtractor from "./pages/ContactExtractor";
import AITools from "./pages/AITools";
import History from "./pages/History";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import PublicRedirect from "./pages/PublicRedirect";

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
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/auth" element={<Auth />} />
              
              {/* Rota pública de redirecionamento */}
              <Route path="/r/:slug" element={<PublicRedirect />} />
              
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
              
              <Route
                path="/contacts"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ContactExtractor />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/ai-tools"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <AITools />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/history"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <History />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AppLayout>
                      <Admin />
                    </AppLayout>
                  </AdminRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

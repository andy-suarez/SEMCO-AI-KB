import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { AuthGuard } from "@/routes/AuthGuard";
import { Layout } from "@/components/Layout";
import { LoginPage } from "@/pages/LoginPage";
import { KBEntriesPage } from "@/pages/KBEntriesPage";
import { UnansweredPage } from "@/pages/UnansweredPage";
import { SyncPage } from "@/pages/SyncPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthGuard />}>
            <Route element={<Layout />}>
              <Route path="/" element={<KBEntriesPage />} />
              <Route path="/unanswered" element={<UnansweredPage />} />
              <Route path="/sync" element={<SyncPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}

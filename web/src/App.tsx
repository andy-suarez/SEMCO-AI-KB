import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { AuthGuard } from "@/routes/AuthGuard";
import { Layout } from "@/components/Layout";
import { KBSectionLayout } from "@/components/KBSectionLayout";
import { LoginPage } from "@/pages/LoginPage";
import { KBEntriesPage } from "@/pages/KBEntriesPage";
import { UnansweredPage } from "@/pages/UnansweredPage";
import { SyncPage } from "@/pages/SyncPage";
import { CalculatorPage } from "@/pages/CalculatorPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<AuthGuard />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/kb" replace />} />

              {/* KB section: nested sub-tabs */}
              <Route path="kb" element={<KBSectionLayout />}>
                <Route index element={<KBEntriesPage />} />
                <Route path="unanswered" element={<UnansweredPage />} />
                <Route path="sync" element={<SyncPage />} />
              </Route>

              {/* Calculator section: no sub-tabs yet, room to grow */}
              <Route path="calculator" element={<CalculatorPage />} />

              {/* Back-compat redirects from the old flat URLs */}
              <Route path="unanswered" element={<Navigate to="/kb/unanswered" replace />} />
              <Route path="sync" element={<Navigate to="/kb/sync" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}

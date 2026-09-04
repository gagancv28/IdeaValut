import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminPage from "./admin/AdminPage";
import AdminLoginPage from "./admin/AdminLoginPage";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import AdminGuard from "./components/AdminGuard";

export default function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <Routes>
          <Route path="/login" element={<AdminLoginPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/*"
            element={
              <AdminGuard>
                <AdminPage />
              </AdminGuard>
            }
          />
        </Routes>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}

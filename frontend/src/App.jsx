import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import POS from "./pages/POS";
import Transfers from "./pages/Transfers";
import Reports from "./pages/Reports";
import AIAssistant from "./pages/AIAssistant";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Login from "./pages/Login";
import ProtectedRoute from "./components/Layout/ProtectedRoute";
import Sidebar from "./components/Layout/Sidebar";
import Navbar from "./components/Layout/Navbar";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const allRoles = [
    "hq_admin",
    "regional_manager",
    "store_supervisor",
    "sales_associate",
  ];
  const supervisorRoles = ["hq_admin", "regional_manager", "store_supervisor"];
  const adminRoles = ["hq_admin"];

  const renderWithLayout = (element) => (
    <div className="min-h-screen bg-[#f8fafc]">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex min-h-[calc(100vh-64px)]">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-6 md:p-8 lg:p-10">{element}</main>
      </div>
    </div>
  );

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={renderWithLayout(
          <ProtectedRoute allowedRoles={allRoles}>
            <Dashboard />
          </ProtectedRoute>,
        )}
      />
      <Route
        path="/inventory"
        element={renderWithLayout(
          <ProtectedRoute allowedRoles={allRoles}>
            <Inventory />
          </ProtectedRoute>,
        )}
      />
      <Route
        path="/pos"
        element={renderWithLayout(
          <ProtectedRoute allowedRoles={allRoles}>
            <POS />
          </ProtectedRoute>,
        )}
      />
      <Route
        path="/transfers"
        element={renderWithLayout(
          <ProtectedRoute allowedRoles={supervisorRoles}>
            <Transfers />
          </ProtectedRoute>,
        )}
      />
      <Route
        path="/reports"
        element={renderWithLayout(
          <ProtectedRoute allowedRoles={supervisorRoles}>
            <Reports />
          </ProtectedRoute>,
        )}
      />
      <Route
        path="/ai"
        element={renderWithLayout(
          <ProtectedRoute allowedRoles={allRoles}>
            <AIAssistant />
          </ProtectedRoute>,
        )}
      />
      <Route
        path="/products"
        element={renderWithLayout(
          <ProtectedRoute allowedRoles={adminRoles}>
            <Products />
          </ProtectedRoute>,
        )}
      />
      <Route
        path="/customers"
        element={renderWithLayout(
          <ProtectedRoute allowedRoles={allRoles}>
            <Customers />
          </ProtectedRoute>,
        )}
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;

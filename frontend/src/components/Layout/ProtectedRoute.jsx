import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../UI/LoadingSpinner";

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6">
        <div className="max-w-md rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm">
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="mt-3 text-sm">
            You do not have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("voltedge_token");
    const storedUser = localStorage.getItem("voltedge_user");

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        localStorage.removeItem("voltedge_user");
      }
    } else if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser({
          id: decoded.sub,
          username: decoded.username || "",
          role: decoded.role || "",
          location_id: decoded.location_id || null,
          email: decoded.email || "",
        });
      } catch (error) {
        localStorage.removeItem("voltedge_token");
      }
    }

    setLoading(false);
  }, []);

  const login = (token, userData) => {
    localStorage.setItem("voltedge_token", token);
    localStorage.setItem("voltedge_user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    navigate("/login");
  };

  const hasRole = (roles = []) => {
    if (!user || !Array.isArray(roles) || roles.length === 0) {
      return false;
    }
    return roles.includes(user.role);
  };

  const value = useMemo(
    () => ({ user, loading, login, logout, hasRole, isAuthenticated: !!user }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

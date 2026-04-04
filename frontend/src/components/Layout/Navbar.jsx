import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const pageTitles = {
  "/": "Dashboard",
  "/inventory": "Inventory",
  "/pos": "Point of Sale",
  "/transfers": "Transfers",
  "/reports": "Reports",
  "/ai": "AI Assistant",
  "/products": "Products",
  "/customers": "Customers",
  "/login": "Login",
};

function Navbar({ onMenuClick }) {
  const location = useLocation();
  const { user } = useAuth();
  const title = pageTitles[location.pathname] || "VoltEdge";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 md:hidden"
          >
            ☰
          </button>
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <h1 className="text-lg font-semibold text-slate-900">
              Welcome back
              {user?.username ? `, ${user.username.split(" ")[0]}` : ""}
            </h1>
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            🔔
            <span>3 Alerts</span>
          </button>

          <div className="flex items-center gap-3 rounded-3xl bg-slate-100 px-4 py-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-200 text-lg text-slate-700">
              {user?.username?.charAt(0)?.toUpperCase() || "V"}
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900">
                {user?.username || "VoltEdge User"}
              </p>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                {user?.role?.replace("_", " ") || "Unknown"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;

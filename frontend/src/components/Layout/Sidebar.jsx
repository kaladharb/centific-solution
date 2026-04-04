import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const navItems = [
  { label: "Dashboard", path: "/", icon: "🏠", roles: "all" },
  {
    label: "Point of Sale",
    path: "/pos",
    icon: "🛒",
    roles: ["hq_admin", "store_supervisor", "sales_associate"],
  },
  { label: "Inventory", path: "/inventory", icon: "📦", roles: "all" },
  {
    label: "Transfers",
    path: "/transfers",
    icon: "🔄",
    roles: ["hq_admin", "regional_manager", "store_supervisor"],
  },
  {
    label: "Reports",
    path: "/reports",
    icon: "📊",
    roles: ["hq_admin", "regional_manager", "store_supervisor"],
  },
  { label: "AI Assistant", path: "/ai", icon: "🤖", roles: "all" },
  { label: "Products", path: "/products", icon: "🏷️", roles: ["hq_admin"] },
  {
    label: "Customers",
    path: "/customers",
    icon: "👥",
    roles: ["hq_admin", "store_supervisor", "sales_associate"],
  },
];

const getInitials = (name) => {
  if (!name) return "V";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const role = user?.role || "";
  const initials = getInitials(user?.username || user?.email || "VoltEdge");

  const allowedNav = navItems.filter((item) => {
    if (item.roles === "all") return true;
    return Array.isArray(item.roles) && item.roles.includes(role);
  });

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-900/50 transition-opacity md:hidden ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed left-0 top-0 z-40 h-full w-64 bg-[#1B3A6B] p-5 text-white shadow-xl transition-transform duration-300 md:static md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="mb-10 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold tracking-tight">⚡ VoltEdge</div>
            <div className="mt-1 text-sm text-slate-200">Commerce</div>
          </div>
          <button
            className="md:hidden rounded-lg bg-white/10 px-3 py-2 text-white hover:bg-white/20"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <nav className="space-y-2">
          {allowedNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-[#E8500A] text-white"
                    : "text-white/85 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-8">
          <div className="flex items-center gap-3 rounded-3xl bg-white/10 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-xl text-orange-600">
              {initials}
            </div>
            <div>
              <div className="font-semibold">
                {user?.username || "VoltEdge User"}
              </div>
              <div className="mt-1 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-widest text-slate-100">
                {role.replace("_", " ")}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-4 w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
          >
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;

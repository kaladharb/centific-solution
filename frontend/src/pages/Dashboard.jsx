import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import KPICard from "../components/UI/KPICard";
import Badge from "../components/UI/Badge";
import LoadingSpinner from "../components/UI/LoadingSpinner";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatRupees(value) {
  return currencyFormatter.format(value || 0);
}

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const dateTo = today.toISOString().slice(0, 10);
    const dateFrom = sevenDaysAgo.toISOString().slice(0, 10);

    setLoading(true);
    setError("");

    Promise.all([
      api.get(
        `/api/reports/sales-summary?date_from=${dateFrom}&date_to=${dateTo}`,
      ),
      api.get("/api/inventory/low-stock-alerts"),
      api.get("/api/inventory/transfers?status=requested"),
      api.get(
        `/api/reports/top-products?limit=5&date_from=${dateFrom}&date_to=${dateTo}`,
      ),
    ])
      .then(([summaryRes, lowStockRes, transferRes, topProductsRes]) => {
        setSummary(summaryRes.data || {});
        setLowStockAlerts(lowStockRes.data || []);
        setPendingTransfers(transferRes.data || []);
        setTopProducts(topProductsRes.data || []);
      })
      .catch((fetchError) => {
        console.error(fetchError);
        setError("Unable to load dashboard data. Please try again later.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const lowStockCount = lowStockAlerts.length;
  const pendingTransferCount = pendingTransfers.length;
  const activeLocations = useMemo(() => {
    const locationNames = new Set();
    lowStockAlerts.forEach((item) => {
      if (item.location_name) locationNames.add(item.location_name);
      if (item.location) locationNames.add(item.location);
    });
    pendingTransfers.forEach((item) => {
      if (item.from_location_name) locationNames.add(item.from_location_name);
      if (item.to_location_name) locationNames.add(item.to_location_name);
    });
    return locationNames.size || 1;
  }, [lowStockAlerts, pendingTransfers]);

  const chartData = useMemo(() => {
    if (Array.isArray(summary.chart_data) && summary.chart_data.length > 0) {
      return summary.chart_data.map((point) => ({
        period: point.period,
        revenue: point.revenue || 0,
      }));
    }

    return Array.from({ length: 7 }, (_, idx) => ({
      period: `Day ${idx + 1}`,
      revenue: 0,
    }));
  }, [summary.chart_data]);

  const topProductData = useMemo(() => {
    if (!Array.isArray(topProducts)) return [];
    return topProducts.map((product) => ({
      product_name: product.product_name || "Unknown Product",
      revenue: product.revenue || 0,
    }));
  }, [topProducts]);

  const canSeeAlerts = [
    "store_supervisor",
    "regional_manager",
    "hq_admin",
  ].includes(user?.role);

  if (loading) {
    return (
      <div className="grid min-h-[calc(100vh-5rem)] place-items-center px-6 py-10">
        <LoadingSpinner message="Loading dashboard metrics…" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900">
              Good morning, {user?.username || "Team"}!
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}{" "}
              · {user?.role?.replace("_", " ") || "Store Associate"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="Today's Revenue"
          value={formatRupees(summary.total_revenue)}
          icon="💰"
          subtitle={`${summary.total_transactions || 0} transactions today`}
          onClick={() => navigate("/reports")}
        />
        <KPICard
          title="Low Stock Alerts"
          value={lowStockCount}
          icon="⚠️"
          subtitle="Items need attention"
          onClick={() => navigate("/inventory?filter=low_stock")}
        />
        <KPICard
          title="Pending Transfers"
          value={pendingTransferCount}
          icon="🔄"
          subtitle="Awaiting approval"
          onClick={() => navigate("/transfers")}
        />
        <KPICard
          title="Active Locations"
          value={activeLocations}
          icon="🏪"
          subtitle="Stores & warehouses"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
                Sales Trend
              </p>
              <h2 className="text-xl font-semibold text-slate-900">
                Last 7 Days
              </h2>
            </div>
            <Badge status={lowStockCount > 0 ? "low" : "healthy"} />
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="salesGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#1B3A6B" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#1B3A6B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0f0f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => formatRupees(value)}
                />
                <Tooltip
                  formatter={(value) => formatRupees(value)}
                  contentStyle={{
                    borderRadius: "1rem",
                    borderColor: "#e2e8f0",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#1B3A6B"
                  fill="url(#salesGradient)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
                Top Products
              </p>
              <h2 className="text-xl font-semibold text-slate-900">
                Revenue Leaders
              </h2>
            </div>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={topProductData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) =>
                    `₹${Math.round(value).toLocaleString("en-IN")}`
                  }
                />
                <YAxis
                  type="category"
                  dataKey="product_name"
                  width={140}
                  tick={{ fontSize: 12, fill: "#0f172a" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => formatRupees(value)}
                  contentStyle={{
                    borderRadius: "1rem",
                    borderColor: "#e2e8f0",
                  }}
                />
                <Bar dataKey="revenue" fill="#E8500A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {canSeeAlerts && lowStockCount > 0 ? (
        <section className="rounded-[2rem] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Recent Low Stock Alerts
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Monitor the most urgent inventory items across locations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/inventory")}
              className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              View All
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {lowStockAlerts.slice(0, 6).map((alert, index) => {
              const quantity =
                alert.quantity_on_hand ?? alert.on_hand ?? alert.quantity ?? 0;
              const location =
                alert.location_name || alert.location || "Unknown location";
              const status =
                quantity <= (alert.reorder_point ?? 0) ? "critical" : "low";
              return (
                <div
                  key={`${alert.product_name}-${index}`}
                  className="rounded-[1.75rem] border border-orange-100 bg-orange-50 p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-orange-600">
                        {alert.product_name || "Product"}
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-900">
                        {location}
                      </p>
                    </div>
                    <Badge status={status} />
                  </div>
                  <div className="mt-4 text-sm text-slate-700">
                    Current stock:{" "}
                    <span className="font-semibold text-slate-900">
                      {quantity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {error ? (
        <div className="rounded-[2rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export default Dashboard;

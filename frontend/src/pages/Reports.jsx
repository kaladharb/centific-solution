import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Badge from "../components/UI/Badge";
import KPICard from "../components/UI/KPICard";
import LoadingSpinner from "../components/UI/LoadingSpinner";

const reportTypes = [
  { id: "sales", label: "Sales Summary", icon: "📊" },
  { id: "top-products", label: "Top Products", icon: "🏆" },
  {
    id: "store-performance",
    label: "Store Performance",
    icon: "🏪",
    roleRequired: ["regional_manager", "hq_admin"],
  },
  { id: "inventory-health", label: "Inventory Health", icon: "📦" },
  { id: "margin-analysis", label: "Margin Analysis", icon: "💹" },
];

function Reports() {
  const { user } = useAuth();
  const [activeReport, setActiveReport] = useState("sales");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [groupBy, setGroupBy] = useState("day");
  const [limit, setLimit] = useState(10);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);

  // Fetch locations and categories
  useEffect(() => {
    api
      .get("/api/locations")
      .then((res) => setLocations(res.data || []))
      .catch(() => {});
    api
      .get("/api/categories")
      .then((res) => setCategories(res.data || []))
      .catch(() => {});
  }, []);

  const availableReports = useMemo(() => {
    return reportTypes.filter(
      (report) =>
        !report.roleRequired || report.roleRequired.includes(user?.role),
    );
  }, [user?.role]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("date_from", dateFrom);
      params.append("date_to", dateTo);
      if (location) params.append("location_id", location);
      if (category) params.append("category_id", category);
      if (groupBy) params.append("group_by", groupBy);
      if (limit) params.append("limit", limit);

      const reportPath =
        activeReport === "sales" ? "sales-summary" : activeReport;
      const response = await api.get(
        `/api/reports/${reportPath}?${params.toString()}`,
      );
      setReportData(response.data);
    } catch (error) {
      console.error("Failed to fetch report:", error);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!reportData) return;

    let csv = "";
    if (activeReport === "sales" && reportData.chart_data) {
      csv = "Period,Revenue,Transactions,Avg Basket\n";
      reportData.chart_data.forEach((row) => {
        csv += `${row.period},${row.revenue},${row.transactions},${row.revenue / (row.transactions || 1)}\n`;
      });
    } else if (activeReport === "top-products" && Array.isArray(reportData)) {
      csv = "Product,Brand,Units Sold,Revenue,Margin%\n";
      reportData.forEach((row) => {
        csv += `${row.product_name},${row.brand},${row.units_sold},${row.revenue},${row.margin_pct}\n`;
      });
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${activeReport}-${new Date().getTime()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 pb-6">
      <section className="rounded-[2rem] bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">
          Reports & Analytics
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Generate insights from your operational data
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[220px,1fr]">
        <div className="flex flex-col gap-2 lg:h-[calc(100vh-20rem)] lg:overflow-y-auto">
          {availableReports.map((report) => (
            <button
              key={report.id}
              type="button"
              onClick={() => {
                setActiveReport(report.id);
                setReportData(null);
              }}
              className={`rounded-3xl px-4 py-3 text-left font-semibold transition ${
                activeReport === report.id
                  ? "bg-[#1B3A6B] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <span className="mr-2">{report.icon}</span>
              {report.label}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          <div className="grid gap-4 rounded-[2rem] bg-white p-6 shadow-sm lg:grid-cols-5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#E8500A]"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#E8500A]"
            />
            {activeReport === "sales" ? (
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                <option value="day">By Day</option>
                <option value="week">By Week</option>
                <option value="month">By Month</option>
              </select>
            ) : activeReport === "top-products" ? (
              <select
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                <option value={10}>Top 10</option>
                <option value={20}>Top 20</option>
                <option value={50}>Top 50</option>
              </select>
            ) : null}
            {["sales", "top-products", "margin-analysis"].includes(
              activeReport,
            ) ? (
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                <option value="">All locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              onClick={fetchReport}
              className="rounded-3xl bg-[#E8500A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#c23e0c]"
            >
              Generate Report
            </button>
          </div>

          {loading ? (
            <LoadingSpinner message="Generating report..." />
          ) : reportData ? (
            <div className="space-y-6">
              {activeReport === "sales" && reportData ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <KPICard
                      title="Total Revenue"
                      value={`₹${(reportData.total_revenue || 0).toLocaleString("en-IN")}`}
                      icon="💰"
                    />
                    <KPICard
                      title="Transactions"
                      value={reportData.total_transactions || 0}
                      icon="🛒"
                    />
                    <KPICard
                      title="Avg Basket"
                      value={`₹${((reportData.total_revenue || 0) / (reportData.total_transactions || 1)).toLocaleString("en-IN")}`}
                      icon="📊"
                    />
                    <KPICard
                      title="Total Discount"
                      value={`₹${(reportData.total_discount_given || 0).toLocaleString("en-IN")}`}
                      icon="🏷️"
                    />
                  </div>
                  <div className="rounded-[2rem] bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">
                      Revenue Trend
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={reportData.chart_data || []}>
                        <defs>
                          <linearGradient
                            id="salesGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#1B3A6B"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="100%"
                              stopColor="#1B3A6B"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value) =>
                            `₹${value.toLocaleString("en-IN")}`
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#1B3A6B"
                          fill="url(#salesGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="rounded-[2rem] bg-white p-6 shadow-sm overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-slate-700">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="px-4 py-3">Period</th>
                          <th className="px-4 py-3 text-right">Revenue</th>
                          <th className="px-4 py-3 text-right">Transactions</th>
                          <th className="px-4 py-3 text-right">Avg Basket</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData.chart_data || []).map((row) => (
                          <tr
                            key={row.period}
                            className="border-b border-slate-200"
                          >
                            <td className="px-4 py-3">{row.period}</td>
                            <td className="px-4 py-3 text-right font-semibold">
                              ₹{(row.revenue || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {row.transactions || 0}
                            </td>
                            <td className="px-4 py-3 text-right">
                              ₹
                              {(
                                (row.revenue || 0) / (row.transactions || 1)
                              ).toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : activeReport === "top-products" &&
                Array.isArray(reportData) ? (
                <>
                  <div className="rounded-[2rem] bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">
                      Revenue by Product
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        layout="vertical"
                        data={reportData.slice(0, 10)}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" />
                        <YAxis
                          type="category"
                          dataKey="product_name"
                          width={150}
                        />
                        <Bar dataKey="revenue" fill="#E8500A" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="rounded-[2rem] bg-white p-6 shadow-sm overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-slate-700">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3">Brand</th>
                          <th className="px-4 py-3 text-right">Units Sold</th>
                          <th className="px-4 py-3 text-right">Revenue</th>
                          <th className="px-4 py-3 text-right">Margin %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((product, index) => (
                          <tr
                            key={product.product_id}
                            className="border-b border-slate-200"
                          >
                            <td className="px-4 py-3 font-semibold">
                              {index + 1}
                            </td>
                            <td className="px-4 py-3">
                              {product.product_name}
                            </td>
                            <td className="px-4 py-3">{product.brand}</td>
                            <td className="px-4 py-3 text-right">
                              {product.units_sold}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              ₹{(product.revenue || 0).toLocaleString("en-IN")}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-semibold ${
                                product.margin_pct > 25
                                  ? "text-green-600"
                                  : product.margin_pct > 15
                                    ? "text-yellow-600"
                                    : "text-red-600"
                              }`}
                            >
                              {(product.margin_pct || 0).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : activeReport === "inventory-health" && reportData ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <KPICard
                      title="Total SKUs"
                      value={reportData.total_skus || 0}
                      icon="📦"
                    />
                    <KPICard
                      title="Healthy"
                      value={reportData.healthy_count || 0}
                      icon="✅"
                    />
                    <KPICard
                      title="Low Stock"
                      value={reportData.low_count || 0}
                      icon="⚠️"
                    />
                    <KPICard
                      title="Critical"
                      value={reportData.critical_count || 0}
                      icon="🔴"
                    />
                  </div>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-[2rem] bg-white p-6 shadow-sm">
                      <h3 className="mb-4 text-lg font-semibold text-slate-900">
                        Inventory Status
                      </h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={[
                              {
                                name: "Healthy",
                                value: reportData.healthy_count,
                              },
                              { name: "Low", value: reportData.low_count },
                              {
                                name: "Critical",
                                value: reportData.critical_count,
                              },
                            ]}
                            dataKey="value"
                            cx="50%"
                            cy="50%"
                            label
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#f59e0b" />
                            <Cell fill="#ef4444" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="rounded-[2rem] bg-white p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Inventory Value
                      </h3>
                      <p className="mt-4 text-3xl font-bold text-slate-900">
                        ₹
                        {(reportData.total_inventory_value || 0).toLocaleString(
                          "en-IN",
                        )}
                      </p>
                    </div>
                  </div>
                </>
              ) : null}
              <button
                type="button"
                onClick={exportCSV}
                className="rounded-3xl border-2 border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 hover:border-slate-300"
              >
                📥 Export as CSV
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default Reports;

function Badge({ status, className = "" }) {
  const variants = {
    healthy: "bg-emerald-100 text-emerald-800",
    completed: "bg-emerald-100 text-emerald-800",
    approved: "bg-sky-100 text-sky-800",
    in_transit: "bg-sky-100 text-sky-800",
    low: "bg-amber-100 text-amber-800",
    pending: "bg-amber-100 text-amber-800",
    critical: "bg-red-100 text-red-800",
    voided: "bg-red-100 text-red-800",
    damaged: "bg-red-100 text-red-800",
    cancelled: "bg-slate-100 text-slate-700",
    gold: "bg-amber-100 text-amber-800",
    silver: "bg-slate-100 text-slate-700",
    bronze: "bg-orange-100 text-orange-800",
    platinum: "bg-purple-100 text-purple-800",
  };

  const badgeClass = variants[status] || "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeClass} ${className}`}
    >
      {status?.toString().replace(/_/g, " ") || "Unknown"}
    </span>
  );
}

export default Badge;

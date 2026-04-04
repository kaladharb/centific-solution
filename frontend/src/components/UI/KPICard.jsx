function KPICard({ title, value, subtitle, icon, trend, trendValue, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-4 text-3xl font-semibold text-slate-900">{value}</p>
        </div>
        {icon ? (
          <div className="rounded-3xl bg-slate-100 p-3 text-xl text-slate-700">
            {icon}
          </div>
        ) : null}
      </div>

      {subtitle ? (
        <p className="mt-4 text-sm text-slate-500">{subtitle}</p>
      ) : null}

      {trend ? (
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600">
          <span>{trend === "positive" ? "▲" : "▼"}</span>
          <span>{trendValue}</span>
          <span className="uppercase tracking-[0.16em] text-[0.6rem] text-slate-500">
            {trend}
          </span>
        </div>
      ) : null}
    </button>
  );
}

export default KPICard;

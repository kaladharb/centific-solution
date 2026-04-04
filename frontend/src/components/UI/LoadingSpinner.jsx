function LoadingSpinner({ message }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl bg-white p-8 text-center shadow-sm">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#1B3A6B]" />
      {message ? (
        <p className="mt-4 text-sm text-slate-500">{message}</p>
      ) : null}
    </div>
  );
}

export default LoadingSpinner;

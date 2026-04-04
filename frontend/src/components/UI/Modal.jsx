import { useEffect } from "react";

function Modal({ isOpen, title, children, onClose }) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="pointer-events-auto absolute inset-0" onClick={onClose} />
      <div className="pointer-events-auto w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Modal;

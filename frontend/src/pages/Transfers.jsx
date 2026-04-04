import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Badge from "../components/UI/Badge";
import LoadingSpinner from "../components/UI/LoadingSpinner";
import Modal from "../components/UI/Modal";

const pageSize = 10;

function Transfers() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("new");
  const [locations, setLocations] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1 });
  const [filters, setFilters] = useState({
    status: "",
    location: "",
    dateFrom: "",
    dateTo: "",
  });
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    action: null,
    transferId: null,
  });
  const [error, setError] = useState("");

  // Form state
  const [form, setForm] = useState({
    from_location_id: user?.location_id || "",
    to_location_id: "",
    products: [],
    notes: "",
  });
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [transferQty, setTransferQty] = useState(1);

  // Fetch locations
  useEffect(() => {
    api
      .get("/api/locations")
      .then((res) => setLocations(res.data || []))
      .catch((err) => console.error("Failed to fetch locations", err));
  }, []);

  // Fetch transfers
  useEffect(() => {
    if (activeTab !== "history") return;

    setLoading(true);
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.location) params.append("location_id", filters.location);

    api
      .get(`/api/inventory/transfers?${params.toString()}`)
      .then((res) => setTransfers(res.data || []))
      .catch((err) => console.error("Failed to fetch transfers", err))
      .finally(() => setLoading(false));
  }, [activeTab, filters]);

  // Product search (debounced)
  useEffect(() => {
    if (!productSearch.trim()) {
      setProductResults([]);
      return;
    }

    const timer = setTimeout(() => {
      api
        .get(`/api/products?search=${productSearch}`)
        .then((res) => {
          const variants = [];
          (res.data || []).forEach((product) => {
            if (product.variants) {
              product.variants.forEach((v) => {
                variants.push({
                  ...v,
                  product_name: product.name,
                  product_id: product.id,
                });
              });
            }
          });
          setProductResults(variants.slice(0, 5));
        })
        .catch(() => setProductResults([]));
    }, 500);

    return () => clearTimeout(timer);
  }, [productSearch]);

  const allLocations = useMemo(() => {
    return locations.map((loc) => ({
      id: loc.id ?? loc.location_id ?? loc,
      name: loc.name ?? loc.location_name ?? String(loc),
    }));
  }, [locations]);

  const getAvailableQtyAtLocation = (variantId, locationId) => {
    // In a real app, this would come from inventory data
    return 50; // placeholder
  };

  const handleAddProduct = (variant) => {
    if (!selectedVariant) {
      setSelectedVariant(variant);
      setTransferQty(1);
      setProductSearch("");
      setProductResults([]);
      return;
    }

    const existingIndex = form.products.findIndex(
      (p) => p.variant_id === variant.id,
    );
    if (existingIndex >= 0) {
      const updated = [...form.products];
      updated[existingIndex].quantity += transferQty;
      setForm((prev) => ({ ...prev, products: updated }));
    } else {
      setForm((prev) => ({
        ...prev,
        products: [
          ...prev.products,
          {
            variant_id: variant.id,
            quantity: transferQty,
            product_name: variant.product_name,
          },
        ],
      }));
    }

    setSelectedVariant(null);
    setTransferQty(1);
    setProductSearch("");
  };

  const handleRemoveProduct = (variantId) => {
    setForm((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.variant_id !== variantId),
    }));
  };

  const handleSubmitTransfer = async (e) => {
    e.preventDefault();
    if (
      !form.from_location_id ||
      !form.to_location_id ||
      form.products.length === 0
    ) {
      setError("Please fill all required fields");
      return;
    }

    setSubmitLoading(true);
    setError("");
    try {
      const response = await api.post("/api/inventory/transfers", {
        from_location_id: form.from_location_id,
        to_location_id: form.to_location_id,
        items: form.products,
        notes: form.notes,
      });

      alert(`Transfer request submitted! ID: #${response.data.id}`);
      setForm({
        from_location_id: user?.location_id || "",
        to_location_id: "",
        products: [],
        notes: "",
      });
      setTransferQty(1);
    } catch (submitError) {
      console.error(submitError);
      setError("Failed to submit transfer request.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleActionConfirm = async () => {
    const { action, transferId } = confirmModal;
    if (!action || !transferId) return;

    const endpoint = {
      approve: `/api/inventory/transfers/${transferId}/approve`,
      complete: `/api/inventory/transfers/${transferId}/complete`,
      cancel: `/api/inventory/transfers/${transferId}/cancel`,
    }[action];

    try {
      if (action === "approve") {
        await api.put(endpoint, {});
      } else if (action === "complete") {
        await api.put(endpoint, {});
      } else if (action === "cancel") {
        await api.put(endpoint, {});
      }

      setTransfers((prev) =>
        prev.map((t) =>
          t.id === transferId
            ? {
                ...t,
                status: {
                  approve: "approved",
                  complete: "completed",
                  cancel: "cancelled",
                }[action],
              }
            : t,
        ),
      );
      setConfirmModal({ isOpen: false, action: null, transferId: null });
    } catch (err) {
      console.error("Action failed:", err);
      alert("Failed to perform action. Please try again.");
    }
  };

  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      if (filters.status && t.status !== filters.status) return false;
      if (
        filters.location &&
        t.from_location_id !== Number(filters.location) &&
        t.to_location_id !== Number(filters.location)
      )
        return false;
      return true;
    });
  }, [transfers, filters]);

  const pageCount = Math.max(1, Math.ceil(filteredTransfers.length / pageSize));
  const currentPage = Math.min(pageCount, Math.max(1, pagination.page));
  const pagedTransfers = filteredTransfers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const canApprove = ["regional_manager", "hq_admin"].includes(user?.role);
  const canComplete = ["store_supervisor", "hq_admin"].includes(user?.role);

  return (
    <div className="space-y-6 pb-6">
      <section className="rounded-[2rem] bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">
          Stock Transfers
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Request and manage stock movements between locations
        </p>
      </section>

      <div className="flex gap-2">
        {["new", "history"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              setPagination({ page: 1 });
            }}
            className={`rounded-3xl px-6 py-3 font-semibold transition ${
              activeTab === tab
                ? "bg-[#1B3A6B] text-white"
                : "border-2 border-slate-200 text-slate-700 hover:border-slate-300"
            }`}
          >
            {tab === "new" ? "✏️ New Transfer" : "📋 Transfer History"}
          </button>
        ))}
      </div>

      {activeTab === "new" ? (
        <section className="rounded-[2rem] bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmitTransfer} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  From Location
                </label>
                <select
                  value={form.from_location_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      from_location_id: e.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#E8500A] focus:ring-4 focus:ring-[#E8500A]/10"
                >
                  <option value="">Select location</option>
                  {allLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  To Location
                </label>
                <select
                  value={form.to_location_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      to_location_id: e.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#E8500A] focus:ring-4 focus:ring-[#E8500A]/10"
                >
                  <option value="">Select location</option>
                  {allLocations
                    .filter(
                      (loc) => String(loc.id) !== String(form.from_location_id),
                    )
                    .map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <label className="block text-sm font-semibold text-slate-700">
                Add Products
              </label>
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products or variants"
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#E8500A]"
              />
              {productResults.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {productResults.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => handleAddProduct(variant)}
                      className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-left text-sm hover:bg-slate-50"
                    >
                      <div className="font-semibold text-slate-900">
                        {variant.product_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {variant.name}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {selectedVariant ? (
              <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4">
                <div className="mb-3">
                  <p className="font-semibold text-slate-900">
                    {selectedVariant.product_name} - {selectedVariant.name}
                  </p>
                  <p className="text-sm text-slate-600">
                    Available:{" "}
                    {getAvailableQtyAtLocation(
                      selectedVariant.id,
                      form.from_location_id,
                    )}{" "}
                    units
                  </p>
                </div>
                <div className="flex gap-3">
                  <input
                    type="number"
                    min="1"
                    value={transferQty}
                    onChange={(e) =>
                      setTransferQty(Math.max(1, Number(e.target.value)))
                    }
                    className="flex-1 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddProduct(selectedVariant)}
                    className="rounded-3xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedVariant(null)}
                    className="rounded-3xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {form.products.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">
                  Items to Transfer
                </p>
                {form.products.map((product) => (
                  <div
                    key={product.variant_id}
                    className="flex items-center justify-between rounded-3xl bg-slate-50 p-4"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {product.product_name}
                      </p>
                      <p className="text-sm text-slate-600">
                        Qty: {product.quantity}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(product.variant_id)}
                      className="rounded-3xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-200"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Notes (optional)
              </label>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={3}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#E8500A]"
              />
            </div>

            {error ? (
              <div className="rounded-3xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitLoading}
              className="inline-flex w-full items-center justify-center rounded-3xl bg-[#1B3A6B] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#153057] disabled:opacity-50"
            >
              {submitLoading ? "Submitting..." : "Request Transfer"}
            </button>
          </form>
        </section>
      ) : (
        <section className="space-y-6">
          <div className="rounded-[2rem] bg-white p-6 shadow-sm space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, status: e.target.value }))
                }
                className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                <option value="">All statuses</option>
                <option value="requested">Pending</option>
                <option value="approved">Approved</option>
                <option value="in_transit">In Transit</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={filters.location}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, location: e.target.value }))
                }
                className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              >
                <option value="">All locations</option>
                {allLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner message="Loading transfers..." />
          ) : (
            <div className="rounded-[2rem] bg-white p-6 shadow-sm overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-700">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">From</th>
                    <th className="px-4 py-3">To</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTransfers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No transfers found
                      </td>
                    </tr>
                  ) : (
                    pagedTransfers.map((transfer) => (
                      <tr
                        key={transfer.id}
                        className="border-b border-slate-200 last:border-b-0"
                      >
                        <td className="px-4 py-3 font-semibold">
                          #{transfer.id}
                        </td>
                        <td className="px-4 py-3">
                          {transfer.from_location_name ||
                            transfer.from_location}
                        </td>
                        <td className="px-4 py-3">
                          {transfer.to_location_name || transfer.to_location}
                        </td>
                        <td className="px-4 py-3">
                          {transfer.product_name || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {transfer.total_quantity || transfer.quantity || 0}
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={transfer.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {new Date(transfer.created_at).toLocaleDateString(
                            "en-IN",
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {canApprove && transfer.status === "requested" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmModal({
                                    isOpen: true,
                                    action: "approve",
                                    transferId: transfer.id,
                                  })
                                }
                                className="rounded-2xl bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-200"
                              >
                                Approve
                              </button>
                            ) : null}
                            {canComplete &&
                            ["in_transit", "approved"].includes(
                              transfer.status,
                            ) ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmModal({
                                    isOpen: true,
                                    action: "complete",
                                    transferId: transfer.id,
                                  })
                                }
                                className="rounded-2xl bg-green-100 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-200"
                              >
                                Complete
                              </button>
                            ) : null}
                            {transfer.status === "requested" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmModal({
                                    isOpen: true,
                                    action: "cancel",
                                    transferId: transfer.id,
                                  })
                                }
                                className="rounded-2xl bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200"
                              >
                                Cancel
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setPagination((prev) => ({
                      page: Math.max(1, prev.page - 1),
                    }))
                  }
                  disabled={currentPage === 1}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPagination((prev) => ({
                      page: Math.min(pageCount, prev.page + 1),
                    }))
                  }
                  disabled={currentPage === pageCount}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <Modal
        isOpen={confirmModal.isOpen}
        title="Confirm Action"
        onClose={() =>
          setConfirmModal({ isOpen: false, action: null, transferId: null })
        }
      >
        <div className="space-y-4">
          <p className="text-slate-700">
            Are you sure you want to {confirmModal.action} this transfer? This
            action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() =>
                setConfirmModal({
                  isOpen: false,
                  action: null,
                  transferId: null,
                })
              }
              className="flex-1 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleActionConfirm}
              className="flex-1 rounded-3xl bg-orange-600 px-4 py-3 font-semibold text-white hover:bg-orange-700"
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Transfers;

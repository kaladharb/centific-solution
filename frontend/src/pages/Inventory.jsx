import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import Badge from "../components/UI/Badge";
import LoadingSpinner from "../components/UI/LoadingSpinner";
import Modal from "../components/UI/Modal";

const pageSize = 10;

function getStatus(item) {
  const onHand = item.quantity_on_hand ?? item.on_hand ?? 0;
  const reorder = item.reorder_point ?? 0;
  if (onHand <= reorder) return "critical";
  if (onHand <= reorder * 2) return "low";
  return "healthy";
}

function formatSearchName(item) {
  const parts = [
    item.product_name || item.product || "",
    item.sku || item.sku_variant || "",
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function formatAttributes(attributes) {
  if (!attributes) return "";
  if (Array.isArray(attributes)) return attributes.join(", ");
  if (typeof attributes === "object")
    return Object.values(attributes).join(", ");
  return String(attributes);
}

function Inventory() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    location_id: "",
    search: "",
    low_stock_only: false,
  });
  const [pagination, setPagination] = useState({ page: 1 });
  const [modals, setModals] = useState({ receive: false, adjust: false });
  const [selectedItem, setSelectedItem] = useState(null);
  const [receiveSearch, setReceiveSearch] = useState("");
  const [receiveItems, setReceiveItems] = useState([]);
  const [adjustDelta, setAdjustDelta] = useState(0);
  const [adjustReason, setAdjustReason] = useState("count_correction");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    const initialFilter = searchParams.get("filter");
    if (initialFilter === "low_stock") {
      setFilters((prev) => ({ ...prev, low_stock_only: true }));
    }
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    setError("");

    const inventoryRequest = api.get("/api/inventory");
    const locationsRequest = api.get("/api/locations");

    Promise.allSettled([inventoryRequest, locationsRequest])
      .then(([inventoryResult, locationsResult]) => {
        if (inventoryResult.status === "fulfilled") {
          setInventory(inventoryResult.value.data || []);
        } else {
          console.warn("Inventory load failed", inventoryResult.reason);
          setError("Unable to load inventory.");
        }

        if (locationsResult.status === "fulfilled") {
          setLocations(locationsResult.value.data || []);
        } else {
          const uniqueLocations = Array.from(
            new Map(
              (inventoryResult.status === "fulfilled"
                ? inventoryResult.value.data
                : []
              ).map((item) => [
                item.location_id || item.location?.id || item.location,
                {
                  id: item.location_id || item.location?.id || item.location,
                  name:
                    item.location_name || item.location || "Unknown location",
                },
              ]),
            ).values(),
          );
          setLocations(uniqueLocations);
        }
      })
      .catch((fetchError) => {
        console.error(fetchError);
        setError("Unable to load inventory dashboard.");
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredInventory = useMemo(() => {
    const base = inventory.map((item) => ({
      ...item,
      product_name: item.product_name || item.product || "Unknown Product",
      sku: item.sku || item.sku_variant || "—",
      variant: item.variant || formatAttributes(item.attributes),
      location_name: item.location_name || item.location || "Unknown Location",
      on_hand: item.quantity_on_hand ?? item.on_hand ?? 0,
      reserved: item.quantity_reserved ?? item.reserved ?? 0,
      available:
        item.available ??
        item.quantity_on_hand - (item.quantity_reserved ?? item.reserved ?? 0),
    }));

    return base.filter((item) => {
      const matchesLocation = filters.location_id
        ? String(
            item.location_id || item.location_id || item.location,
          )?.includes(String(filters.location_id))
        : true;
      const matchesSearch = filters.search
        ? formatSearchName(item).includes(filters.search.trim().toLowerCase())
        : true;
      const matchesLowStock = filters.low_stock_only
        ? getStatus(item) !== "healthy"
        : true;
      return matchesLocation && matchesSearch && matchesLowStock;
    });
  }, [filters, inventory]);

  const pageCount = Math.max(1, Math.ceil(filteredInventory.length / pageSize));
  const currentPage = Math.min(pageCount, Math.max(1, pagination.page));
  const pagedInventory = filteredInventory.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const locationOptions = useMemo(() => {
    return locations.map((location) => ({
      id: location.id ?? location.location_id ?? location,
      name: location.name ?? location.location_name ?? String(location),
    }));
  }, [locations]);

  const openReceiveModal = () => {
    setReceiveItems([]);
    setReceiveSearch("");
    setModals((prev) => ({ ...prev, receive: true }));
  };

  const closeReceiveModal = () =>
    setModals((prev) => ({ ...prev, receive: false }));
  const closeAdjustModal = () =>
    setModals((prev) => ({ ...prev, adjust: false }));

  const receiveSearchResults = useMemo(() => {
    const query = receiveSearch.trim().toLowerCase();
    if (!query) return [];
    return inventory
      .filter((item) => formatSearchName(item).includes(query))
      .slice(0, 5)
      .map((item) => ({
        variant_id: item.variant_id || item.id,
        product_name: item.product_name || item.product || "Unknown Product",
        sku: item.sku || item.sku_variant || "—",
        location_id: item.location_id || item.location?.id || item.location,
        location_name:
          item.location_name || item.location || "Unknown Location",
      }));
  }, [inventory, receiveSearch]);

  const addReceiveItem = (item) => {
    if (
      !receiveItems.find((selected) => selected.variant_id === item.variant_id)
    ) {
      setReceiveItems((prev) => [...prev, { ...item, quantity: 1 }]);
    }
    setReceiveSearch("");
  };

  const setReceiveItemQty = (variantId, quantity) => {
    setReceiveItems((prev) =>
      prev.map((item) =>
        item.variant_id === variantId ? { ...item, quantity } : item,
      ),
    );
  };

  const removeReceiveItem = (variantId) => {
    setReceiveItems((prev) =>
      prev.filter((item) => item.variant_id !== variantId),
    );
  };

  const handleOpenAdjust = (item) => {
    setSelectedItem(item);
    setAdjustDelta(0);
    setAdjustReason("count_correction");
    setAdjustNotes("");
    setModals((prev) => ({ ...prev, adjust: true }));
  };

  const handleSubmitReceive = async (event) => {
    event.preventDefault();
    if (!receiveItems.length) {
      setError("Add at least one item before receiving stock.");
      return;
    }
    setSubmitLoading(true);
    setError("");

    try {
      await api.post("/api/inventory/receipts", {
        location_id: receiveItems[0].location_id || filters.location_id,
        items: receiveItems.map((item) => ({
          variant_id: item.variant_id,
          quantity: Number(item.quantity),
        })),
      });
      alert("Stock received successfully.");
      closeReceiveModal();
      const inventoryResult = await api.get("/api/inventory");
      setInventory(inventoryResult.data || []);
    } catch (submitError) {
      console.error(submitError);
      setError("Failed to receive stock. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSubmitAdjust = async (event) => {
    event.preventDefault();
    if (!selectedItem) return;
    const currentQty =
      selectedItem.quantity_on_hand ?? selectedItem.on_hand ?? 0;
    const delta = Number(adjustDelta);
    if (Number.isNaN(delta)) {
      setError("Enter a valid adjustment quantity.");
      return;
    }
    if (currentQty + delta < 0) {
      setError("New quantity cannot be negative.");
      return;
    }

    setSubmitLoading(true);
    setError("");
    try {
      await api.post("/api/inventory/adjustments", {
        variant_id: selectedItem.variant_id || selectedItem.id,
        location_id: selectedItem.location_id,
        quantity_change: delta,
        reason: adjustReason,
        notes: adjustNotes,
      });
      alert("Inventory adjustment saved.");
      closeAdjustModal();
      const inventoryResult = await api.get("/api/inventory");
      setInventory(inventoryResult.data || []);
    } catch (submitError) {
      console.error(submitError);
      setError("Unable to save adjustment. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const lowStockAlerts = useMemo(() => {
    return inventory.filter((item) => getStatus(item) !== "healthy");
  }, [inventory]);

  if (loading) {
    return (
      <div className="grid min-h-[calc(100vh-5rem)] place-items-center px-6 py-10">
        <LoadingSpinner message="Loading inventory…" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-[2rem] bg-white p-8 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            Inventory Management
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Track stock levels, receive stock, and manage adjustments across
            locations.
          </p>
        </div>
        <button
          type="button"
          onClick={openReceiveModal}
          className="inline-flex items-center justify-center rounded-3xl bg-[#1B3A6B] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#153057]"
        >
          Receive Stock
        </button>
      </section>

      <section className="rounded-[2rem] bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[280px_1fr_240px_auto] lg:items-center">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Location
            </span>
            <select
              value={filters.location_id}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  location_id: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#E8500A] focus:ring-4 focus:ring-[#E8500A]/10"
            >
              <option value="">All locations</option>
              {locationOptions.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Search</span>
            <input
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, search: event.target.value }))
              }
              placeholder="Search by product or SKU..."
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#E8500A] focus:ring-4 focus:ring-[#E8500A]/10"
            />
          </label>

          <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex h-5 w-10 items-center rounded-full bg-slate-200 p-[3px]">
              <button
                type="button"
                className={`h-4 w-4 rounded-full bg-white shadow-sm transition ${filters.low_stock_only ? "translate-x-5" : ""}`}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    low_stock_only: !prev.low_stock_only,
                  }))
                }
                aria-label="Toggle low stock only"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Low Stock Only
              </p>
              <p className="text-xs text-slate-500">
                Show critical and low stock items.
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-50 px-5 py-4 text-sm text-slate-700">
            {filteredInventory.length} items
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-700">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3 text-right">On Hand</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Reorder Pt</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedInventory.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    <div className="mx-auto inline-flex max-w-sm flex-col items-center gap-3 rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 p-10">
                      <div className="text-4xl">📦</div>
                      <p className="text-lg font-semibold text-slate-900">
                        No inventory matched your filters.
                      </p>
                      <p className="text-sm text-slate-500">
                        Adjust filters or receive stock to see more items here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedInventory.map((item, index) => {
                  const status = getStatus(item);
                  return (
                    <tr
                      key={`${item.inventory_id || index}-${item.variant_id}-${index}`}
                      className="border-b border-slate-200 last:border-b-0"
                    >
                      <td className="px-4 py-4 align-top">
                        <div className="font-semibold text-slate-900">
                          {item.product_name}
                        </div>
                        {item.brand ? (
                          <div className="text-xs text-slate-500">
                            {item.brand}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 align-top text-slate-700">
                        {item.sku}
                      </td>
                      <td className="px-4 py-4 align-top">
                        {item.variant ? (
                          <div className="flex flex-wrap gap-2">
                            {item.variant.split(" / ").map((part) => (
                              <span
                                key={part}
                                className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600"
                              >
                                {part}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top text-slate-700">
                        {item.location_name}
                      </td>
                      <td className="px-4 py-4 align-top text-right font-semibold text-slate-900">
                        {item.on_hand}
                      </td>
                      <td className="px-4 py-4 align-top text-right text-slate-700">
                        {item.reserved ?? 0}
                      </td>
                      <td className="px-4 py-4 align-top text-right text-slate-700">
                        {item.available}
                      </td>
                      <td className="px-4 py-4 align-top text-right text-slate-700">
                        {item.reorder_point ?? "—"}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Badge status={status} />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <button
                          type="button"
                          onClick={() => handleOpenAdjust(item)}
                          className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Showing {pagedInventory.length} of {filteredInventory.length} items
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setPagination((prev) => ({ page: Math.max(1, prev.page - 1) }))
              }
              disabled={currentPage === 1}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-50"
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
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <Modal
        isOpen={modals.receive}
        title="Receive Stock"
        onClose={closeReceiveModal}
      >
        <form onSubmit={handleSubmitReceive} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Location
            </label>
            <select
              value={receiveItems[0]?.location_id || filters.location_id || ""}
              onChange={(event) => {
                const locationValue = event.target.value;
                setReceiveItems((prev) =>
                  prev.map((item) => ({ ...item, location_id: locationValue })),
                );
              }}
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#E8500A] focus:ring-4 focus:ring-[#E8500A]/10"
            >
              <option value="">Select location</option>
              {locationOptions.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Add Items</p>
              <span className="text-xs text-slate-500">
                Search for variants
              </span>
            </div>
            <input
              value={receiveSearch}
              onChange={(event) => setReceiveSearch(event.target.value)}
              placeholder="Search product or SKU"
              className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#E8500A] focus:ring-4 focus:ring-[#E8500A]/10"
            />
            {receiveSearchResults.length > 0 ? (
              <div className="space-y-2">
                {receiveSearchResults.map((item) => (
                  <button
                    key={`${item.variant_id}-${item.sku}`}
                    type="button"
                    onClick={() => addReceiveItem(item)}
                    className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-900 transition hover:bg-slate-50"
                  >
                    <div className="font-semibold">{item.product_name}</div>
                    <div className="text-xs text-slate-500">
                      {item.sku} · {item.location_name}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            {receiveItems.length > 0 ? (
              receiveItems.map((item) => (
                <div
                  key={item.variant_id}
                  className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {item.product_name}
                    </div>
                    <div className="text-sm text-slate-500">{item.sku}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) =>
                        setReceiveItemQty(
                          item.variant_id,
                          Number(event.target.value),
                        )
                      }
                      className="w-24 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeReceiveItem(item.variant_id)}
                      className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">
                Search and add items to receive stock.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">
              PO Reference
            </label>
            <input
              name="poReference"
              placeholder="Purchase order reference"
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#E8500A] focus:ring-4 focus:ring-[#E8500A]/10"
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
            className="inline-flex w-full items-center justify-center rounded-3xl bg-[#1B3A6B] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#153057] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitLoading ? "Receiving stock…" : "Submit receipt"}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={modals.adjust}
        title="Inventory Adjustment"
        onClose={closeAdjustModal}
      >
        {selectedItem ? (
          <form onSubmit={handleSubmitAdjust} className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Product</div>
              <div className="mt-2 font-semibold text-slate-900">
                {selectedItem.product_name || selectedItem.product}
              </div>
              <div className="text-sm text-slate-500">
                Current quantity:{" "}
                {selectedItem.quantity_on_hand ?? selectedItem.on_hand ?? 0}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Quantity change
              </label>
              <input
                type="number"
                value={adjustDelta}
                onChange={(event) => setAdjustDelta(Number(event.target.value))}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#E8500A] focus:ring-4 focus:ring-[#E8500A]/10"
              />
            </div>

            <div>
              <p className="text-sm text-slate-700">New quantity will be:</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {Number(
                  selectedItem.quantity_on_hand ?? selectedItem.on_hand ?? 0,
                ) + Number(adjustDelta)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Reason
              </label>
              <select
                value={adjustReason}
                onChange={(event) => setAdjustReason(event.target.value)}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#E8500A] focus:ring-4 focus:ring-[#E8500A]/10"
              >
                <option value="damaged">Damaged</option>
                <option value="missing">Missing</option>
                <option value="count_correction">Count correction</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Notes
              </label>
              <textarea
                value={adjustNotes}
                onChange={(event) => setAdjustNotes(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#E8500A] focus:ring-4 focus:ring-[#E8500A]/10"
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
              className="inline-flex w-full items-center justify-center rounded-3xl bg-[#1B3A6B] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#153057] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitLoading ? "Saving adjustment…" : "Submit adjustment"}
            </button>
          </form>
        ) : (
          <p className="text-sm text-slate-600">
            Select an item to adjust inventory.
          </p>
        )}
      </Modal>

      <section className="rounded-[2rem] bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Low Stock Alerts
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Items that need replenishment or transfer support.
            </p>
          </div>
          <Badge
            status={lowStockAlerts.length > 0 ? "low" : "healthy"}
            className="rounded-full px-4 py-2 text-sm"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {lowStockAlerts.length === 0 ? (
            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6 text-slate-600">
              No low stock items found. Inventory levels are healthy across your
              chosen locations.
            </div>
          ) : (
            lowStockAlerts.slice(0, 6).map((item) => {
              const qty = item.quantity_on_hand ?? item.on_hand ?? 0;
              const suggestion = item.transfer_suggestion || item.available_at;
              return (
                <div
                  key={`${item.variant_id || item.id}-${item.sku}`}
                  className="rounded-[1.75rem] border-l-4 border-orange-400 bg-slate-50 p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {item.product_name || item.product}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.location_name || item.location}
                      </p>
                    </div>
                    <Badge status="low" />
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-3xl bg-white px-4 py-3 text-sm">
                      <div className="text-xs text-slate-500">Current</div>
                      <div className="mt-1 font-semibold text-slate-900 text-lg">
                        {qty}
                      </div>
                    </div>
                    <div className="rounded-3xl bg-white px-4 py-3 text-sm">
                      <div className="text-xs text-slate-500">Reorder at</div>
                      <div className="mt-1 font-semibold text-slate-900 text-lg">
                        {item.reorder_point ?? "—"}
                      </div>
                    </div>
                  </div>
                  {suggestion ? (
                    <div className="mt-4 rounded-3xl bg-white px-4 py-3 text-sm text-slate-700">
                      Available at:{" "}
                      <span className="font-semibold text-slate-900">
                        {suggestion}
                      </span>
                    </div>
                  ) : null}
                  {suggestion ? (
                    <button
                      type="button"
                      onClick={() =>
                        navigate("/transfers", {
                          state: { suggestedLocation: suggestion, item },
                        })
                      }
                      className="mt-4 rounded-3xl bg-[#E8500A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#c23e0c]"
                    >
                      Request Transfer
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>

      {error ? (
        <div className="rounded-[2rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export default Inventory;

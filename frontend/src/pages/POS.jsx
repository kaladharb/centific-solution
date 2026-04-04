import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Badge from "../components/UI/Badge";
import LoadingSpinner from "../components/UI/LoadingSpinner";
import Modal from "../components/UI/Modal";

function POS() {
  const { user } = useAuth();
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [customer, setCustomer] = useState(null);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loading, setLoading] = useState(false);
  const [productLoading, setProductLoading] = useState(true);
  const [successData, setSuccessData] = useState(null);
  const [activeTab, setActiveTab] = useState("cart");
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [variantSelectorOpen, setVariantSelectorOpen] = useState(false);
  const [variantPending, setVariantPending] = useState(null);

  // Fetch products
  useEffect(() => {
    api
      .get("/api/products?is_active=true")
      .then((res) => setProducts(res.data || []))
      .catch((err) => console.error("Failed to fetch products", err))
      .finally(() => setProductLoading(false));
  }, []);

  // Customer search (debounced)
  useEffect(() => {
    if (!customerPhone || customerPhone.length < 10) {
      setCustomerSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      api
        .get(`/api/customers/lookup?phone=${customerPhone}`)
        .then((res) => setCustomerSearchResults(res.data ? [res.data] : []))
        .catch(() => setCustomerSearchResults([]));
    }, 500);

    return () => clearTimeout(timer);
  }, [customerPhone]);

  // Product search (debounced)
  useEffect(() => {
    if (!searchQuery.trim()) return;

    const timer = setTimeout(() => {
      // Filter products locally for demo
      const filtered = products.filter(
        (p) =>
          p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.sku?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setProducts((prev) => [...filtered]);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const cartMetrics = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.subtotal ?? 0), 0);
    const totalDiscount = cart.reduce(
      (sum, item) => sum + (item.discount ?? 0) * (item.quantity ?? 0),
      0,
    );
    const tax = (subtotal - totalDiscount) * 0.18;
    const total = subtotal - totalDiscount + tax;
    return { subtotal, totalDiscount, tax, total };
  }, [cart]);

  const handleAddToCart = useCallback(
    (product) => {
      if (!product.variants || product.variants.length > 1) {
        setVariantPending(product);
        setVariantSelectorOpen(true);
        return;
      }

      const variant = product.variants?.[0] || {};
      const price = variant.price ?? product.price ?? 0;
      const inventory = variant.inventory || [];
      const available = inventory.reduce(
        (sum, inv) => sum + (inv.quantity_on_hand ?? 0),
        0,
      );

      if (available <= 0) {
        alert("Out of stock");
        return;
      }

      const existingCartItem = cart.find(
        (item) => item.variant_id === variant.id,
      );
      if (existingCartItem) {
        setCart((prev) =>
          prev.map((item) =>
            item.variant_id === variant.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  subtotal:
                    (item.quantity + 1) *
                    (item.unit_price - (item.discount ?? 0)),
                }
              : item,
          ),
        );
      } else {
        setCart((prev) => [
          ...prev,
          {
            variant_id: variant.id,
            variant,
            product_name: product.name,
            brand: product.brand,
            quantity: 1,
            unit_price: price,
            discount: 0,
            subtotal: price,
          },
        ]);
      }
    },
    [cart],
  );

  const handleVariantSelect = useCallback(
    (variant) => {
      if (!variantPending) return;
      const price = variant.price ?? variantPending.price ?? 0;
      const inventory = variant.inventory || [];
      const available = inventory.reduce(
        (sum, inv) => sum + (inv.quantity_on_hand ?? 0),
        0,
      );

      if (available <= 0) {
        alert("Out of stock for this variant");
        return;
      }

      setCart((prev) => [
        ...prev,
        {
          variant_id: variant.id,
          variant,
          product_name: variantPending.name,
          brand: variantPending.brand,
          quantity: 1,
          unit_price: price,
          discount: 0,
          subtotal: price,
        },
      ]);
      setVariantSelectorOpen(false);
      setVariantPending(null);
    },
    [variantPending],
  );

  const handleQuantityChange = (variantId, quantity) => {
    if (quantity < 1) return;
    setCart((prev) =>
      prev.map((item) =>
        item.variant_id === variantId
          ? {
              ...item,
              quantity,
              subtotal: quantity * (item.unit_price - (item.discount ?? 0)),
            }
          : item,
      ),
    );
  };

  const handleDiscountChange = (variantId, discount) => {
    setCart((prev) =>
      prev.map((item) =>
        item.variant_id === variantId
          ? {
              ...item,
              discount: Math.max(0, discount),
              subtotal:
                item.quantity * (item.unit_price - Math.max(0, discount)),
            }
          : item,
      ),
    );
  };

  const handleRemoveFromCart = (variantId) => {
    setCart((prev) => prev.filter((item) => item.variant_id !== variantId));
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      alert("Cart is empty");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/api/sales/transactions", {
        customer_id: customer?.id,
        items: cart.map((item) => ({
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
        })),
        payment_method: paymentMethod,
        location_id: user?.location_id,
      });

      setSuccessData(response.data);
      setCart([]);
      setCustomer(null);
      setCustomerPhone("");
    } catch (error) {
      console.error("Sale failed:", error);
      alert("Failed to complete sale. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleNewSale = () => {
    setSuccessData(null);
    setCart([]);
    setCustomer(null);
    setCustomerPhone("");
    setPaymentMethod("cash");
  };

  if (successData) {
    return (
      <div className="grid min-h-screen place-items-center gap-6 bg-gradient-to-br from-emerald-50 to-emerald-100 p-6">
        <div className="rounded-[2rem] bg-white p-10 text-center shadow-2xl">
          <div className="text-6xl">✅</div>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900">
            Sale Completed!
          </h1>
          <div className="mt-6 space-y-2 text-slate-600">
            <p>
              Invoice:{" "}
              <span className="font-semibold text-slate-900">
                {successData.invoice_number}
              </span>
            </p>
            <p>
              Total:{" "}
              <span className="text-2xl font-bold text-emerald-600">
                ₹{successData.total?.toLocaleString("en-IN")}
              </span>
            </p>
            <p>
              Payment:{" "}
              <span className="font-semibold text-slate-900">
                {paymentMethod.toUpperCase()}
              </span>
            </p>
            {customer && successData.loyalty_points_earned ? (
              <p className="text-emerald-700">
                +{successData.loyalty_points_earned} loyalty points earned!
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleNewSale}
            className="mt-8 rounded-3xl bg-emerald-600 px-6 py-3 text-lg font-semibold text-white transition hover:bg-emerald-700"
          >
            New Sale
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="hidden lg:flex h-screen gap-6 p-6">
        <div className="flex w-2/5 flex-col rounded-[2rem] bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-semibold text-slate-900">
              Shopping Cart
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700">
                Customer Phone
              </label>
              <div className="flex gap-2">
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Search by phone number"
                  className="flex-1 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#E8500A] focus:ring-4 focus:ring-[#E8500A]/10"
                />
                {customer ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomer(null);
                      setCustomerPhone("");
                    }}
                    className="rounded-3xl bg-red-100 px-4 py-3 text-red-600 font-semibold hover:bg-red-200"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
              {customerSearchResults.length > 0 && !customer ? (
                <div className="space-y-2">
                  {customerSearchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomer(c);
                        setCustomerSearchResults([]);
                      }}
                      className="w-full rounded-3xl border border-emerald-200 bg-emerald-50 p-3 text-left text-sm hover:bg-emerald-100"
                    >
                      <div className="font-semibold text-slate-900">
                        {c.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {c.phone} • {c.tier || "Standard"}
                      </div>
                      <div className="text-xs text-slate-600">
                        {c.loyalty_points || 0} points
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
              {customer ? (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="font-semibold text-slate-900">
                    {customer.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {customer.tier || "Standard"} •{" "}
                    {customer.loyalty_points || 0} points
                  </div>
                </div>
              ) : null}
            </div>

            {cart.length === 0 ? (
              <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                <p>Add products from the right panel to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.variant_id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">
                          {item.product_name}
                        </p>
                        {item.variant?.name ? (
                          <p className="text-xs text-slate-500">
                            {item.variant.name}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.variant_id)}
                        className="rounded-full bg-red-100 px-2 py-1 text-red-600 hover:bg-red-200"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleQuantityChange(
                              item.variant_id,
                              item.quantity - 1,
                            )
                          }
                          className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold hover:bg-slate-300"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleQuantityChange(
                              item.variant_id,
                              item.quantity + 1,
                            )
                          }
                          className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold hover:bg-slate-300"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          ₹{item.unit_price}
                        </p>
                        <p className="font-semibold text-slate-900">
                          ₹{item.subtotal?.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={item.discount}
                      onChange={(e) =>
                        handleDiscountChange(
                          item.variant_id,
                          Number(e.target.value),
                        )
                      }
                      placeholder="₹ discount"
                      className="w-full rounded-3xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#E8500A]"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 space-y-4 p-5">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold">
                  ₹{cartMetrics.subtotal?.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Discount:</span>
                <span className="font-semibold text-red-600">
                  −₹{cartMetrics.totalDiscount?.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>GST (18%):</span>
                <span className="font-semibold">
                  ₹{cartMetrics.tax?.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="my-3 border-t border-slate-300" />
              <div className="flex justify-between text-lg">
                <span className="font-bold">Total:</span>
                <span className="text-2xl font-bold text-orange-600">
                  ₹{cartMetrics.total?.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              {["cash", "card", "upi"].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`flex-1 rounded-3xl py-3 text-sm font-semibold transition ${
                    paymentMethod === method
                      ? "bg-[#1B3A6B] text-white"
                      : "border-2 border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {method === "cash"
                    ? "💵 Cash"
                    : method === "card"
                      ? "💳 Card"
                      : "📱 UPI"}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCompleteSale}
              disabled={cart.length === 0 || loading}
              className="w-full rounded-3xl bg-[#E8500A] px-6 py-4 text-lg font-semibold text-white transition hover:bg-[#c23e0c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Processing..." : "Complete Sale"}
            </button>
          </div>
        </div>

        <div className="flex w-3/5 flex-col rounded-[2rem] bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              Products
            </h2>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Search products by name or SKU..."
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#E8500A] focus:ring-4 focus:ring-[#E8500A]/10"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {productLoading ? (
              <LoadingSpinner message="Loading products..." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {products.length === 0 ? (
                  <p className="col-span-2 text-center text-slate-500">
                    No products found
                  </p>
                ) : (
                  products.map((product) => {
                    const totalStock =
                      product.variants?.reduce(
                        (sum, v) =>
                          sum +
                          (v.inventory?.reduce(
                            (s, inv) => s + (inv.quantity_on_hand ?? 0),
                            0,
                          ) ?? 0),
                        0,
                      ) ?? 0;
                    const price =
                      product.variants?.[0]?.price ?? product.price ?? 0;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleAddToCart(product)}
                        disabled={totalStock === 0}
                        className="rounded-3xl border border-slate-200 bg-white p-4 text-left transition hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <h3 className="font-semibold text-slate-900">
                          {product.name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {product.brand} • {product.category}
                        </p>
                        <p className="mt-3 text-lg font-bold text-[#E8500A]">
                          ₹{price.toLocaleString("en-IN")}
                        </p>
                        <div className="mt-2">
                          <Badge
                            status={
                              totalStock > 10
                                ? "healthy"
                                : totalStock > 0
                                  ? "low"
                                  : "critical"
                            }
                          />
                          <span className="ml-2 text-xs text-slate-600">
                            {totalStock} available
                          </span>
                        </div>
                        {product.variants && product.variants.length > 1 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {product.variants.slice(0, 3).map((v) => (
                              <span
                                key={v.id}
                                className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700"
                              >
                                {v.name}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="lg:hidden p-4 pb-20">
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("cart")}
            className={`flex-1 rounded-3xl py-3 font-semibold ${
              activeTab === "cart"
                ? "bg-[#1B3A6B] text-white"
                : "border-2 border-slate-200 text-slate-700"
            }`}
          >
            Cart ({cart.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`flex-1 rounded-3xl py-3 font-semibold ${
              activeTab === "products"
                ? "bg-[#1B3A6B] text-white"
                : "border-2 border-slate-200 text-slate-700"
            }`}
          >
            Products
          </button>
        </div>

        {activeTab === "cart" ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-sm space-y-6">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700">
                Customer Phone
              </label>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Search by phone number"
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#E8500A]"
              />
            </div>

            {cart.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
                <p>Add products to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.variant_id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-3 space-y-2"
                  >
                    <p className="font-semibold text-slate-900">
                      {item.product_name}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleQuantityChange(
                            item.variant_id,
                            item.quantity - 1,
                          )
                        }
                        className="rounded-full bg-slate-200 px-2 py-1 text-sm font-semibold"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleQuantityChange(
                            item.variant_id,
                            item.quantity + 1,
                          )
                        }
                        className="rounded-full bg-slate-200 px-2 py-1 text-sm font-semibold"
                      >
                        +
                      </button>
                      <span className="flex-1 text-right font-semibold text-slate-900">
                        ₹{item.subtotal?.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 border-t border-slate-200 pt-4">
              <div className="flex justify-between text-sm">
                <span>Total:</span>
                <span className="text-xl font-bold text-orange-600">
                  ₹{cartMetrics.total?.toLocaleString("en-IN")}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCompleteSale}
                disabled={cart.length === 0 || loading}
                className="w-full rounded-3xl bg-[#E8500A] px-6 py-3 font-semibold text-white disabled:opacity-50"
              >
                Complete Sale
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Search products..."
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#E8500A]"
            />
            <div className="grid gap-3">
              {products.map((product) => {
                const totalStock =
                  product.variants?.reduce(
                    (sum, v) =>
                      sum +
                      (v.inventory?.reduce(
                        (s, inv) => s + (inv.quantity_on_hand ?? 0),
                        0,
                      ) ?? 0),
                    0,
                  ) ?? 0;
                const price =
                  product.variants?.[0]?.price ?? product.price ?? 0;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleAddToCart(product)}
                    disabled={totalStock === 0}
                    className="rounded-3xl border border-slate-200 bg-white p-4 text-left transition disabled:opacity-50"
                  >
                    <h3 className="font-semibold text-slate-900">
                      {product.name}
                    </h3>
                    <p className="text-lg font-bold text-[#E8500A] mt-2">
                      ₹{price.toLocaleString("en-IN")}
                    </p>
                    <span className="text-xs text-slate-600">
                      {totalStock} available
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={variantSelectorOpen}
        title="Select Variant"
        onClose={() => setVariantSelectorOpen(false)}
      >
        <div className="space-y-3">
          {variantPending?.variants?.map((variant) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => handleVariantSelect(variant)}
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left hover:bg-slate-100"
            >
              <div className="font-semibold text-slate-900">{variant.name}</div>
              <div className="text-sm text-slate-600">
                ₹
                {(variant.price ?? variantPending.price ?? 0).toLocaleString(
                  "en-IN",
                )}
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export default POS;

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Minus, Trash2, X, Percent, DollarSign } from "lucide-react";
import { CartItem, Payment, Product } from "@/types/models";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const paymentMethods = [
  { key: "dinheiro" as const, label: "Dinheiro", icon: DollarSign },
  { key: "pix" as const, label: "Pix", icon: DollarSign },
  { key: "debito" as const, label: "Débito", icon: DollarSign },
  { key: "credito" as const, label: "Crédito", icon: DollarSign },
];

export default function PDV() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"value" | "percent">("value");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [primaryMethod, setPrimaryMethod] = useState<Payment["method"]>("dinheiro");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const cashReceivedRef = useRef<HTMLInputElement>(null);
  const cashReceivedSnapshotRef = useRef<number | null>(null);
  const cartRef = useRef<CartItem[]>([]);

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.barcode.includes(searchTerm)
      ),
    [products, searchTerm]
  );

  const visibleProducts = useMemo(
    () => (searchTerm.trim() ? filteredProducts : products),
    [filteredProducts, products, searchTerm]
  );

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar produtos", { description: error.message });
      setLoadingProducts(false);
      return;
    }

    const mapped: Product[] = (data ?? []).map((r) => {
      const costPrice = Number(r.cost_price ?? 0);
      const salePrice = Number(r.sale_price ?? 0);
      return {
        id: r.id,
        name: r.name,
        barcode: String(r.barcode ?? "").trim(),
        category: r.category ?? "",
        brand: r.brand ?? "",
        costPrice,
        salePrice,
        margin: costPrice > 0 ? ((salePrice - costPrice) / costPrice) * 100 : 0,
        stock: r.stock ?? 0,
        minStock: r.min_stock ?? 0,
        unit: (r.unit as Product["unit"]) ?? "unidade",
      };
    });
    setProducts(mapped);
    setLoadingProducts(false);
  }, []);

  const normalizeBarcodeScan = (raw: string) =>
    raw.replace(/[\r\n\t\u0000]/g, "").trim();

  const subtotal = cart.reduce((a, i) => a + (Number(i.quantity || 0) * Number(i.unitPrice || 0)), 0);
  const discountAmount = discountType === "percent" ? subtotal * ((Number(discount) || 0) / 100) : (Number(discount) || 0);
  const total = Math.max(0, subtotal - discountAmount);
  const paid = showPayment ? payments.reduce((a, p) => a + (Number(p.amount) || 0), 0) : total;
  const remaining = Math.max(0, total - paid);

  const positivePayments = useMemo(() => payments.filter((p) => p.amount > 0), [payments]);
  const isDinheiroOnlyCheckout =
    (!showPayment && primaryMethod === "dinheiro") ||
    (showPayment &&
      positivePayments.length > 0 &&
      positivePayments.every((p) => p.method === "dinheiro"));

  const parseMoneyLocal = (raw: string) => {
    const t = raw.trim();
    if (!t) return 0;
    if (t.includes(",") && t.includes(".")) {
      const n = parseFloat(t.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    }
    if (t.includes(",")) {
      const n = parseFloat(t.replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    }
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  };

  const cashReceivedValue = parseMoneyLocal(cashReceivedInput);
  const cashChangePreview = Math.max(0, cashReceivedValue - total);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    void loadProducts();

    const channel = supabase
      .channel("realtime:pdv-products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          void loadProducts();
        }
      )
      .subscribe();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        if (cartRef.current.length > 0) setShowPayment(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadProducts();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [loadProducts]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) return;
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void loadProducts();
      }
    });
    return () => subscription.unsubscribe();
  }, [loadProducts]);

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        const newQty = existing.quantity + 1;
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: newQty, total: newQty * i.unitPrice }
            : i
        );
      }
      const unitPrice = Number(product.salePrice) || 0;
      return [
        ...prev,
        { productId: product.id, name: product.name, quantity: 1, unitPrice, total: unitPrice },
      ];
    });
    setSearchTerm("");
    searchRef.current?.focus();
  }, []);

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId) return i;
          const newQty = Math.max(0, i.quantity + delta);
          return { ...i, quantity: newQty, total: newQty * i.unitPrice };
        })
        .filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
    toast("Produto removido");
  };

  const updatePayment = (method: Payment["method"], amount: number) => {
    setPayments((prev) => {
      const existing = prev.find((p) => p.method === method);
      if (existing) { if (amount === 0) return prev.filter((p) => p.method !== method); return prev.map((p) => (p.method === method ? { ...p, amount } : p)); }
      if (amount > 0) return [...prev, { method, amount }];
      return prev;
    });
  };

  const buildPaymentsPayload = (): { method: Payment["method"]; amount: number }[] => {
    if (!showPayment) {
      return [{ method: primaryMethod, amount: total }];
    }
    if (positivePayments.length > 0 && positivePayments.every((p) => p.method === "dinheiro")) {
      return [{ method: "dinheiro", amount: total }];
    }
    return positivePayments.map((p) => ({ method: p.method, amount: p.amount }));
  };

  const requestFinalize = () => {
    if (cart.length === 0 || isFinalizing) return;
    if (showPayment && remaining > 0.01) {
      toast.error("Valor insuficiente. Faltam R$ " + remaining.toFixed(2));
      return;
    }
    if (isDinheiroOnlyCheckout) {
      setCashReceivedInput("");
      setCashModalOpen(true);
      queueMicrotask(() => cashReceivedRef.current?.focus());
      return;
    }
    void finalizeSaleDb();
  };

  const confirmCashAndFinalize = () => {
    if (cashReceivedValue + 0.005 < total) {
      toast.error("Valor recebido insuficiente", {
        description: `Falta R$ ${Math.max(0, total - cashReceivedValue).toFixed(2)} para cobrir o total.`,
      });
      return;
    }
    cashReceivedSnapshotRef.current = cashReceivedValue;
    setCashModalOpen(false);
    setCashReceivedInput("");
    void finalizeSaleDb();
  };

  const finalizeSaleDb = async () => {
    if (isFinalizing) return;
    if (remaining > 0.01) {
      toast.error("Valor insuficiente. Faltam R$ " + remaining.toFixed(2));
      return;
    }

    setIsFinalizing(true);
    try {
      const { data: cash } = await supabase
        .from("cash_registers")
        .select("id")
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cash?.id) {
        cashReceivedSnapshotRef.current = null;
        toast.error("Caixa fechado. Abra o caixa antes de vender.");
        return;
      }

    const itemsPayload = cart.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      unit_price: i.unitPrice,
    }));

    const paymentsPayload = buildPaymentsPayload();

    const discountValue = discountType === "percent" ? subtotal * (discount / 100) : discount;

      const { data, error } = await supabase.rpc("create_sale", {
        _items: itemsPayload,
        _discount: discountValue,
        _payments: paymentsPayload,
        _cash_register_id: cash.id,
        _client_id: null,
      });

      if (error) {
        cashReceivedSnapshotRef.current = null;
        toast.error("Erro ao finalizar venda", { description: error.message });
        return;
      }

      const receivedSnap = cashReceivedSnapshotRef.current;
      cashReceivedSnapshotRef.current = null;
      const change =
        receivedSnap != null && receivedSnap > total + 0.005 ? receivedSnap - total : 0;
      const successDescription =
        change > 0.005
          ? `Venda: ${String(data).slice(0, 8)} | Total: R$ ${total.toFixed(2)} | Troco: R$ ${change.toFixed(2)}`
          : `Venda: ${String(data).slice(0, 8)} | Total: R$ ${total.toFixed(2)}`;

      toast.success("Venda Finalizada!", { description: successDescription });
      setCart([]);
      setDiscount(0);
      setPayments([]);
      setShowPayment(false);
      searchRef.current?.focus();
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <>
    <Dialog
      open={cashModalOpen}
      onOpenChange={(open) => {
        setCashModalOpen(open);
        if (!open) setCashReceivedInput("");
      }}
    >
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Pagamento em dinheiro</DialogTitle>
          <DialogDescription>
            Informe quanto o cliente entregou. O troco é calculado em relação ao total da venda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total da venda</span>
            <span className="font-mono-tabular font-semibold text-foreground">R$ {total.toFixed(2)}</span>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="pdv-cash-received" className="text-xs font-medium text-foreground">
              Valor recebido
            </label>
            <input
              id="pdv-cash-received"
              ref={cashReceivedRef}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={cashReceivedInput}
              onChange={(e) => setCashReceivedInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmCashAndFinalize();
                }
              }}
              placeholder="0,00"
              className="h-10 w-full px-3 rounded-md bg-muted text-base font-mono-tabular text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex justify-between items-center rounded-lg bg-muted/60 px-3 py-2.5">
            <span className="text-sm text-muted-foreground">Troco</span>
            <span
              className={`font-mono-tabular text-lg font-semibold ${
                cashReceivedValue + 0.005 < total
                  ? "text-muted-foreground"
                  : "text-primary"
              }`}
            >
              {cashReceivedInput.trim() === ""
                ? "R$ 0,00"
                : cashReceivedValue + 0.005 < total
                  ? "—"
                  : `R$ ${cashChangePreview.toFixed(2)}`}
            </span>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={() => setCashModalOpen(false)}
            className="h-10 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmCashAndFinalize}
            disabled={cashReceivedInput.trim() === "" || cashReceivedValue + 0.005 < total}
            className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirmar venda
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 border-r border-border lg:w-[60%]">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const code = normalizeBarcodeScan((e.currentTarget as HTMLInputElement).value);
                  if (!code) return;
                  const product = products.find((p) => p.barcode === code);
                  if (product) {
                    addToCart(product);
                  } else {
                    toast.error("Produto não encontrado pelo código de barras");
                  }
                }
              }}
              placeholder="Buscar produto ou código de barras... (Ctrl+K)"
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-fast"
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {visibleProducts.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">
                {products.length === 0
                  ? "Nenhum produto cadastrado. Cadastre produtos na aba Produtos."
                  : "Nenhum produto encontrado para esta busca."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {visibleProducts.map((product) => (
                <motion.button
                  key={product.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => addToCart(product)}
                  className="bg-card rounded-xl shadow-card p-4 text-left transition-fast hover:shadow-elevated group"
                >
                  <div className="text-sm font-medium text-foreground group-hover:text-primary transition-fast truncate">
                    {product.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {product.category}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-mono-tabular text-base font-semibold text-foreground">
                      R$ {product.salePrice.toFixed(2)}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        product.stock <= product.minStock
                          ? product.stock === 0
                            ? "bg-destructive/10 text-destructive"
                            : "bg-warning/10 text-warning"
                          : "bg-success/10 text-success"
                      }`}
                    >
                      {product.stock} un.
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-[40%] max-w-xl flex flex-col bg-card">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Carrinho</h2>
          <span className="text-xs text-muted-foreground">{cart.length} {cart.length === 1 ? "item" : "itens"}</span>
        </div>
        <div className="flex-1 overflow-auto">
          <AnimatePresence mode="popLayout">
            {cart.length === 0 ? (
              <div className="flex items-center justify-center h-full"><p className="text-sm text-muted-foreground">Nenhum produto adicionado</p></div>
            ) : (
              cart.map((cartItem) => (
                <motion.div key={cartItem.productId} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: "spring", duration: 0.3, bounce: 0 }} className="flex items-center justify-between px-4 py-3 border-b border-border group">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="text-sm font-medium text-foreground truncate">{cartItem.name}</div>
                    <div className="text-xs text-muted-foreground font-mono-tabular">R$ {cartItem.unitPrice.toFixed(2)} × {cartItem.quantity}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQuantity(cartItem.productId, -1)} className="h-6 w-6 rounded-md bg-muted flex items-center justify-center transition-fast hover:bg-accent"><Minus className="h-3 w-3" /></button>
                      <span className="w-6 text-center text-sm font-mono-tabular font-medium">{cartItem.quantity}</span>
                      <button onClick={() => updateQuantity(cartItem.productId, 1)} className="h-6 w-6 rounded-md bg-muted flex items-center justify-center transition-fast hover:bg-accent"><Plus className="h-3 w-3" /></button>
                    </div>
                    <span className="font-mono-tabular text-sm font-semibold w-20 text-right">R$ {(Number(cartItem.total) || 0).toFixed(2)}</span>
                    <button onClick={() => removeFromCart(cartItem.productId)} className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 flex items-center justify-center text-destructive transition-fast hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        <div className="border-t border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">Desconto</span>
            <div className="flex items-center gap-1 flex-1">
              <button onClick={() => setDiscountType(discountType === "value" ? "percent" : "value")} className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground transition-fast hover:bg-accent">
                {discountType === "value" ? <DollarSign className="h-3 w-3" /> : <Percent className="h-3 w-3" />}
              </button>
              <input type="number" value={discount || ""} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="h-8 flex-1 px-2 rounded-md bg-muted text-sm font-mono-tabular text-foreground focus:outline-none focus:ring-2 focus:ring-primary" placeholder="0,00" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-mono-tabular text-foreground">R$ {subtotal.toFixed(2)}</span></div>
            {discountAmount > 0 && (<div className="flex justify-between text-sm"><span className="text-muted-foreground">Desconto</span><span className="font-mono-tabular text-destructive">- R$ {discountAmount.toFixed(2)}</span></div>)}
            <div className="flex justify-between items-baseline pt-2 border-t border-border">
              <span className="text-sm font-semibold text-foreground">Total</span>
              <span className={`display-total font-mono-tabular text-foreground ${remaining <= 0.01 && cart.length > 0 ? "glow-primary text-primary" : ""}`}>R$ {total.toFixed(2)}</span>
            </div>
          </div>
          {!showPayment && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">Forma de pagamento</span>
              <select
                value={primaryMethod}
                onChange={(e) => setPrimaryMethod(e.target.value as Payment["method"])}
                className="h-8 px-2 rounded-md bg-muted text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {paymentMethods.map((pm) => (
                  <option key={pm.key} value={pm.key}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {showPayment ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Pagamento</span>
                <button onClick={() => setShowPayment(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              {paymentMethods.map((pm) => {
                const current = payments.find((p) => p.method === pm.key)?.amount || 0;
                return (
                  <div key={pm.key} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16">{pm.label}</span>
                    <input type="number" value={current || ""} onChange={(e) => updatePayment(pm.key, parseFloat(e.target.value) || 0)} className="h-8 flex-1 px-2 rounded-md bg-muted text-sm font-mono-tabular text-foreground focus:outline-none focus:ring-2 focus:ring-primary" placeholder="0,00" />
                  </div>
                );
              })}
              <div className="flex justify-between text-sm pt-2 border-t border-border">
                <span className="text-muted-foreground">Restante</span>
                <motion.span layout className={`font-mono-tabular font-semibold ${remaining <= 0.01 ? "text-success" : "text-foreground"}`}>R$ {remaining.toFixed(2)}</motion.span>
              </div>
              <button
                onClick={requestFinalize}
                disabled={remaining > 0.01 || isFinalizing}
                className={`w-full h-11 rounded-lg text-sm font-semibold transition-fast ${
                  remaining <= 0.01 && !isFinalizing
                    ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                {isFinalizing ? "Finalizando..." : "Finalizar Venda"}
              </button>
            </motion.div>
          ) : (
            <div className="space-y-2 pt-2 border-t border-border">
              <button
                onClick={requestFinalize}
                disabled={cart.length === 0 || isFinalizing}
                className={`w-full h-11 rounded-lg text-sm font-semibold transition-fast ${
                  cart.length > 0 && !isFinalizing
                    ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                {isFinalizing ? "Finalizando..." : "Finalizar Venda"}
              </button>
              <p className="text-[10px] text-muted-foreground text-right">
                F9 para pagamento múltiplo
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

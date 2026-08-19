"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "../../lib/firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

export default function WaiterPage() {
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [tableId, setTableId] = useState("");
  const [cart, setCart] = useState({}); // "menuId:variant" -> qty
  const [variants, setVariants] = useState({}); // menuId -> "full" | "half"
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState([]);

  useEffect(() => {
    const unsubTables = onSnapshot(
      query(collection(db, "tables"), orderBy("createdAt", "asc")),
      (snap) => setTables(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubMenu = onSnapshot(
      query(collection(db, "menu"), orderBy("createdAt", "desc")),
      (snap) => setMenu(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubOrder = onSnapshot(doc(db, "config", "categoryOrder"), (snap) => {
      const data = snap.data();
      setCategoryOrder(data?.order || []);
    });
    return () => {
      unsubTables();
      unsubMenu();
      unsubOrder();
    };
  }, []);

  const grouped = useMemo(() => {
    const byCategory = {};
    for (const item of menu) {
      const cat = item.category || "General";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    }
    const cats = Object.keys(byCategory);
    cats.sort((a, b) => {
      const ai = categoryOrder.indexOf(a);
      const bi = categoryOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    const sorted = {};
    for (const cat of cats) {
      sorted[cat] = byCategory[cat];
    }
    return sorted;
  }, [menu, categoryOrder]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([key, qty]) => {
        const [menuId, variant] = key.split(":");
        const item = menu.find((m) => m.id === menuId);
        if (!item) return null;
        const price = getItemPrice(item, variant);
        const name = getItemLabel(item, variant);
        return { menuId, name, price, qty, variant };
      })
      .filter(Boolean);
  }, [cart, menu]);

  const total = cartItems.reduce((sum, i) => sum + i.qty * i.price, 0);

  function getItemPrice(item, variant) {
    if (variant === "half") return item.halfPrice || 0;
    return item.fullPrice || item.price || 0;
  }

  function getItemLabel(item, variant) {
    if (variant === "half") return `Half ${item.name}`;
    return item.name;
  }

  function changeVariant(menuId, variant) {
    setVariants((prev) => ({ ...prev, [menuId]: variant }));
  }

  function changeQty(menuId, variant, delta) {
    const key = `${menuId}:${variant}`;
    setCart((prev) => {
      const next = { ...prev, [key]: Math.max(0, (prev[key] || 0) + delta) };
      return next;
    });
  }

  async function submitOrder() {
    if (!tableId || cartItems.length === 0) return;
    setSubmitting(true);
    try {
      const table = tables.find((t) => t.id === tableId);
      await addDoc(collection(db, "orders"), {
        tableId,
        tableName: table ? table.name : "Unknown",
        items: cartItems.map((i) => ({
          name: i.name,
          price: i.price,
          qty: i.qty,
        })),
        total,
        status: "placed",
        printedBy: [],
        createdAt: serverTimestamp(),
      });
      setCart({});
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 2500);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="waiter-page">
      <div className="container">
        <h1>Waiter</h1>

        <div className="card">
          <label>Table</label>
          <select value={tableId} onChange={(e) => setTableId(e.target.value)}>
            <option value="">Select a table</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {tables.length === 0 && (
            <p style={{ fontSize: 13, color: "#666" }}>
              No tables yet — add tables in Admin first.
            </p>
          )}
        </div>

        {Object.keys(grouped).length === 0 && (
          <p style={{ color: "#666" }}>No menu items yet — add some in Admin.</p>
        )}

        {Object.entries(grouped).map(([category, items]) => (
          <div className="card" key={category}>
            <strong>{category}</strong>
            <div className="menu-grid">
              {items.map((item) => {
                const hasHalf = !!item.halfPrice;
                const variant = variants[item.id] || "full";
                const price = getItemPrice(item, variant);
                const key = `${item.id}:${variant}`;
                const qty = cart[key] || 0;
                return (
                  <div className="menu-item" key={item.id}>
                    <div className="menu-item-name">{item.name}</div>
                    <div className="menu-item-price">
                      {hasHalf ? (
                        <>
                          <span className={variant === "half" ? "price-highlight" : ""}>Half: Rs. {item.halfPrice}</span>
                          <span className="price-sep">|</span>
                          <span className={variant === "full" ? "price-highlight" : ""}>Full: Rs. {item.fullPrice || item.price}</span>
                        </>
                      ) : (
                        <>Rs. {item.fullPrice || item.price}</>
                      )}
                    </div>
                    {hasHalf && (
                      <div className="variant-selector">
                        <button
                          className={`variant-btn ${variant === "full" ? "active" : ""}`}
                          onClick={() => changeVariant(item.id, "full")}
                        >
                          Full
                        </button>
                        <button
                          className={`variant-btn ${variant === "half" ? "active" : ""}`}
                          onClick={() => changeVariant(item.id, "half")}
                        >
                          Half
                        </button>
                      </div>
                    )}
                    <div className="stepper">
                      <button onClick={() => changeQty(item.id, variant, -1)}>−</button>
                      <span>{qty}</span>
                      <button onClick={() => changeQty(item.id, variant, 1)}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {cartItems.length > 0 && (
          <div className="card">
            <strong>Order summary</strong>
            {cartItems.map((i) => (
              <div className="row" key={i.menuId} style={{ marginTop: 6 }}>
                <span>
                  {i.name} x{i.qty}
                </span>
                <span>Rs. {i.qty * i.price}</span>
              </div>
            ))}
            <div className="row" style={{ marginTop: 10, fontWeight: 700 }}>
              <span>Total</span>
              <span>Rs. {total}</span>
            </div>
          </div>
        )}

        <div className="waiter-footer">
          <a href="/" className="btn btn-secondary">Back</a>
          <button
            className="btn btn-primary"
            disabled={!tableId || cartItems.length === 0 || submitting}
            onClick={submitOrder}
          >
            {submitting
              ? "Sending..."
              : justSubmitted
              ? "Order sent ✓"
              : "Order Taken — Send to Print"}
          </button>
        </div>
      </div>
    </div>
  );
}

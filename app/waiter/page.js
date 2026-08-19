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
  const [cart, setCart] = useState({}); // menuId -> qty
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    const unsubTables = onSnapshot(
      query(collection(db, "tables"), orderBy("createdAt", "asc")),
      (snap) => setTables(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubMenu = onSnapshot(
      query(collection(db, "menu"), orderBy("createdAt", "desc")),
      (snap) => setMenu(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsubTables();
      unsubMenu();
    };
  }, []);

  const grouped = useMemo(() => {
    const byCategory = {};
    for (const item of menu) {
      const cat = item.category || "General";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    }
    return byCategory;
  }, [menu]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([menuId, qty]) => {
        const item = menu.find((m) => m.id === menuId);
        return item ? { menuId, name: item.name, price: item.price, qty } : null;
      })
      .filter(Boolean);
  }, [cart, menu]);

  const total = cartItems.reduce((sum, i) => sum + i.qty * i.price, 0);

  function changeQty(menuId, delta) {
    setCart((prev) => {
      const next = { ...prev, [menuId]: Math.max(0, (prev[menuId] || 0) + delta) };
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
            {items.map((item) => (
              <div className="menu-item" key={item.id}>
                <div className="menu-item-name">{item.name}</div>
                <div className="menu-item-price">Rs. {item.price}</div>
                <div className="stepper">
                  <button onClick={() => changeQty(item.id, -1)}>−</button>
                  <span>{cart[item.id] || 0}</span>
                  <button onClick={() => changeQty(item.id, 1)}>+</button>
                </div>
              </div>
            ))}
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

      <a href="/" className="btn btn-secondary" style={{ marginTop: 8 }}>
        Back
      </a>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  getDocs,
  setDoc,
} from "firebase/firestore";

export default function AdminPage() {
  const [tab, setTab] = useState("menu");

  return (
    <div className="container">
      <h1>Admin</h1>
      <div className="tabs">
        <div
          className={`tab ${tab === "menu" ? "active" : ""}`}
          onClick={() => setTab("menu")}
        >
          Menu
        </div>
        <div
          className={`tab ${tab === "categories" ? "active" : ""}`}
          onClick={() => setTab("categories")}
        >
          Categories
        </div>
        <div
          className={`tab ${tab === "tables" ? "active" : ""}`}
          onClick={() => setTab("tables")}
        >
          Tables
        </div>
        <div
          className={`tab ${tab === "orders" ? "active" : ""}`}
          onClick={() => setTab("orders")}
        >
          Orders
        </div>
      </div>
      {tab === "menu" ? <MenuAdmin /> : tab === "categories" ? <CategoriesAdmin /> : tab === "tables" ? <TablesAdmin /> : <OrdersAdmin />}
      <a href="/" className="btn btn-secondary" style={{ marginTop: 8 }}>
        Back
      </a>
    </div>
  );
}

function MenuAdmin() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [fullPrice, setFullPrice] = useState("");
  const [halfPrice, setHalfPrice] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "menu"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  async function addItem(e) {
    e.preventDefault();
    if (!name.trim() || !fullPrice) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "menu"), {
        name: name.trim(),
        fullPrice: Number(fullPrice),
        halfPrice: halfPrice ? Number(halfPrice) : null,
        category: category.trim() || "General",
        createdAt: serverTimestamp(),
      });
      setName("");
      setFullPrice("");
      setHalfPrice("");
      setCategory("");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id) {
    await deleteDoc(doc(db, "menu", id));
  }

  return (
    <div>
      <div className="card">
        <form onSubmit={addItem}>
          <input
            placeholder="Item name (e.g. Paneer Tikka)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="Full price (Rs.)"
            type="number"
            value={fullPrice}
            onChange={(e) => setFullPrice(e.target.value)}
          />
          <input
            placeholder="Half price (Rs.) — optional"
            type="number"
            value={halfPrice}
            onChange={(e) => setHalfPrice(e.target.value)}
          />
          <input
            placeholder="Category (e.g. Starters) — optional"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Adding..." : "Add Item"}
          </button>
        </form>
      </div>

      {items.length === 0 && (
        <p style={{ color: "#666" }}>No menu items yet — add one above.</p>
      )}

      {items.map((item) => (
        <div className="card row" key={item.id}>
          <div>
            <strong>{item.name}</strong>
            <div style={{ fontSize: 13, color: "#666" }}>
              {item.category}
              {item.halfPrice
                ? ` · Full: Rs. ${item.fullPrice || item.price} · Half: Rs. ${item.halfPrice}`
                : ` · Rs. ${item.fullPrice || item.price}`}
            </div>
          </div>
          <button
            className="btn btn-danger"
            style={{ width: "auto", padding: "8px 12px" }}
            onClick={() => removeItem(item.id)}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

function CategoriesAdmin() {
  const [categories, setCategories] = useState([]);
  const [order, setOrder] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubItems = onSnapshot(
      query(collection(db, "menu"), orderBy("createdAt", "desc")),
      (snap) => {
        const cats = new Set();
        snap.docs.forEach((d) => {
          const cat = d.data().category || "General";
          cats.add(cat);
        });
        setCategories(Array.from(cats));
      }
    );
    const unsubOrder = onSnapshot(doc(db, "config", "categoryOrder"), (snap) => {
      const data = snap.data();
      setOrder(data?.order || []);
    });
    return () => {
      unsubItems();
      unsubOrder();
    };
  }, []);

  async function saveOrder(newOrder) {
    setSaving(true);
    try {
      await setDoc(doc(db, "config", "categoryOrder"), { order: newOrder }, { merge: true });
      setOrder(newOrder);
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...categories].sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  async function moveCategory(sortedIndex, direction) {
    const targetIndex = sortedIndex + direction;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const newOrder = [...sorted];
    [newOrder[sortedIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[sortedIndex]];
    await saveOrder(newOrder);
  }

  return (
    <div>
      <div className="card">
        <strong>Category Order</strong>
        <p style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
          This controls how categories appear for waiters.
        </p>
      </div>
      {sorted.length === 0 && (
        <p style={{ color: "#666" }}>No categories yet.</p>
      )}
      {sorted.map((cat, idx) => (
        <div className="card row" key={cat}>
          <strong>{cat}</strong>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="btn btn-secondary"
              style={{ width: "auto", padding: "8px 12px" }}
              onClick={() => moveCategory(idx, -1)}
              disabled={idx === 0 || saving}
            >
              ↑
            </button>
            <button
              className="btn btn-secondary"
              style={{ width: "auto", padding: "8px 12px" }}
              onClick={() => moveCategory(idx, 1)}
              disabled={idx === sorted.length - 1 || saving}
            >
              ↓
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function TablesAdmin() {
  const [tables, setTables] = useState([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "tables"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setTables(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  async function addTable(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "tables"), {
        name: name.trim(),
        createdAt: serverTimestamp(),
      });
      setName("");
    } finally {
      setSaving(false);
    }
  }

  async function removeTable(id) {
    await deleteDoc(doc(db, "tables", id));
  }

  return (
    <div>
      <div className="card">
        <form onSubmit={addTable}>
          <input
            placeholder="Table name (e.g. Table 5 or Patio 2)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Adding..." : "Add Table"}
          </button>
        </form>
      </div>

      {tables.length === 0 && (
        <p style={{ color: "#666" }}>No tables yet — add one above.</p>
      )}

      {tables.map((t) => (
        <div className="card row" key={t.id}>
          <strong>{t.name}</strong>
          <button
            className="btn btn-danger"
            style={{ width: "auto", padding: "8px 12px" }}
            onClick={() => removeTable(t.id)}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

function OrdersAdmin() {
  const [orders, setOrders] = useState([]);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  async function clearAllOrders() {
    const confirmed = window.confirm(
      `This will permanently delete all ${orders.length} order(s). Continue?`
    );
    if (!confirmed) return;
    setClearing(true);
    try {
      const snap = await getDocs(collection(db, "orders"));
      const deletes = snap.docs.map((d) => deleteDoc(doc(db, "orders", d.id)));
      await Promise.all(deletes);
      setOrders([]);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong>All Orders</strong>
          <div style={{ fontSize: 13, color: "#666" }}>
            {orders.length} order(s) in history
          </div>
        </div>
        {orders.length > 0 && (
          <button
            className="btn btn-danger"
            style={{ width: "auto", padding: "10px 16px" }}
            onClick={clearAllOrders}
            disabled={clearing}
          >
            {clearing ? "Clearing..." : "Clear All Orders"}
          </button>
        )}
      </div>

      {orders.length === 0 && (
        <p style={{ color: "#666" }}>No orders yet.</p>
      )}

      {orders.map((order) => (
        <div className="card row" key={order.id}>
          <div>
            <strong>Table {order.tableName}</strong>
            <div style={{ fontSize: 13, color: "#666" }}>
              {order.items.length} item(s) · Rs. {order.total} · {order.status}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

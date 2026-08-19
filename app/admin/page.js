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
          className={`tab ${tab === "tables" ? "active" : ""}`}
          onClick={() => setTab("tables")}
        >
          Tables
        </div>
      </div>
      {tab === "menu" ? <MenuAdmin /> : <TablesAdmin />}
      <a href="/" className="btn btn-secondary" style={{ marginTop: 8 }}>
        Back
      </a>
    </div>
  );
}

function MenuAdmin() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
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
    if (!name.trim() || !price) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "menu"), {
        name: name.trim(),
        price: Number(price),
        category: category.trim() || "General",
        createdAt: serverTimestamp(),
      });
      setName("");
      setPrice("");
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
            placeholder="Price (Rs.)"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
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
              {item.category} · Rs. {item.price}
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

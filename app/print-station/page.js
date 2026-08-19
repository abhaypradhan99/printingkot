"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "../../lib/firebase";
import {
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { BluetoothPrinter } from "../../lib/printer";
import { buildReceiptBytes } from "../../lib/receipt";

// Give this print station a stable identity on this phone, so we know
// which orders it has already printed even after a page reload.
function getStationId() {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("station_id");
  if (!id) {
    id = "station_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("station_id", id);
  }
  return id;
}

export default function PrintStationPage() {
  const [connected, setConnected] = useState(false);
  const [printerName, setPrinterName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [log, setLog] = useState([]);
  const [restaurantName, setRestaurantName] = useState("My Restaurant");
  const [orders, setOrders] = useState([]);
  const printerRef = useRef(null);
  const stationIdRef = useRef(null);
  const printingQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    stationIdRef.current = getStationId();
    printerRef.current = new BluetoothPrinter(stationIdRef.current);

    const savedName = localStorage.getItem("restaurant_name");
    if (savedName) setRestaurantName(savedName);

    // Try a silent reconnect on load (works if the browser remembers
    // permission for this device — Chrome-only, not guaranteed).
    printerRef.current.tryReconnect().then((ok) => {
      if (ok) setConnected(true);
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const allOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOrders(allOrders);
      snap.docChanges().forEach((change) => {
        if (change.type === "added" || change.type === "modified") {
          const order = { id: change.doc.id, ...change.doc.data() };
          maybePrint(order);
        }
      });
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  function addLog(msg) {
    setLog((prev) => [
      { time: new Date().toLocaleTimeString(), msg },
      ...prev.slice(0, 19),
    ]);
  }

  // Queue prints so we never write to the Bluetooth characteristic
  // concurrently for two orders that land at nearly the same time.
  function maybePrint(order) {
    if (!order.createdAt) return; // wait for server timestamp to resolve
    const stationId = stationIdRef.current;
    const alreadyPrinted = (order.printedBy || []).includes(stationId);
    if (alreadyPrinted) return;
    if (!printerRef.current || !printerRef.current.isConnected()) return;

    printingQueueRef.current = printingQueueRef.current
      .then(() => printOrder(order))
      .catch((e) => addLog(`Print failed for ${order.tableName}: ${e.message}`));
  }

  async function printOrder(order) {
    const bytes = buildReceiptBytes({
      restaurantName,
      tableName: order.tableName,
      orderId: order.id.slice(-6).toUpperCase(),
      items: order.items,
      createdAt: order.createdAt?.toMillis
        ? order.createdAt.toMillis()
        : Date.now(),
    });
    await printerRef.current.writeBytes(bytes);
    addLog(`Printed order for ${order.tableName}`);
    await updateDoc(doc(db, "orders", order.id), {
      printedBy: arrayUnion(stationIdRef.current),
    });
  }

  async function handleManualPrint(order) {
    setError("");
    if (!connected || !printerRef.current || !printerRef.current.isConnected()) {
      setError("Printer not connected");
      return;
    }
    try {
      await printOrder(order);
      addLog(`Reprinted order for ${order.tableName}`);
    } catch (e) {
      const msg = e.message || "Print failed";
      setError(msg);
      addLog(`Reprint failed for ${order.tableName}: ${msg}`);
    }
  }

  async function handleConnect() {
    setError("");
    setConnecting(true);
    try {
      const name = await printerRef.current.requestAndConnect();
      setPrinterName(name);
      setConnected(true);
      addLog(`Connected to ${name}`);
    } catch (e) {
      setError(e.message || "Couldn't connect to printer.");
    } finally {
      setConnecting(false);
    }
  }

  function handleDisconnect() {
    printerRef.current.disconnect();
    setConnected(false);
    addLog("Disconnected");
  }

  function saveRestaurantName(name) {
    setRestaurantName(name);
    localStorage.setItem("restaurant_name", name);
  }

  function formatTime(createdAt) {
    if (!createdAt) return "";
    const ms = createdAt.toMillis ? createdAt.toMillis() : new Date(createdAt).getTime();
    return new Date(ms).toLocaleString();
  }

  return (
    <div className="container">
      <h1>Print Station</h1>

      <div
        className={`status-banner ${
          connected ? "status-connected" : "status-disconnected"
        }`}
      >
        {connected
          ? `Connected to ${printerName || "printer"}. Keep this tab open — new orders will print automatically.`
          : "Not connected. Tap Connect and pick your Bluetooth printer from the list."}
      </div>

      {error && (
        <div className="status-banner status-disconnected">{error}</div>
      )}

      <div className="card">
        <label>Restaurant name (printed on receipts)</label>
        <input
          value={restaurantName}
          onChange={(e) => saveRestaurantName(e.target.value)}
        />
      </div>

      <div className="card">
        {!connected ? (
          <button
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? "Opening Bluetooth picker..." : "Connect Printer"}
          </button>
        ) : (
          <button className="btn btn-secondary" onClick={handleDisconnect}>
            Disconnect
          </button>
        )}
        <p style={{ fontSize: 13, color: "#666", marginTop: 8 }}>
          Use Chrome on Android. Make sure the printer is powered on and
          paired/discoverable before tapping Connect.
        </p>
      </div>

      <div className="card">
        <strong>Orders</strong>
        {orders.length === 0 && (
          <p style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
            No orders yet.
          </p>
        )}
        {orders.map((order) => {
          const stationId = stationIdRef.current;
          const alreadyPrinted = (order.printedBy || []).includes(stationId);
          return (
            <div className="order-card" key={order.id}>
              <div className="order-header">
                <div>
                  <div className="order-table">Table {order.tableName}</div>
                  <div className="order-time">{formatTime(order.createdAt)}</div>
                </div>
                <span className={`print-status ${alreadyPrinted ? "printed" : "pending"}`}>
                  {alreadyPrinted ? "Printed" : "Pending"}
                </span>
              </div>
              {order.items.map((item, idx) => (
                <div className="order-item" key={idx}>
                  <span>{item.name}</span>
                  <span>x{item.qty} — Rs. {item.qty * item.price}</span>
                </div>
              ))}
              <div className="order-total">
                <span>Total</span>
                <span>Rs. {order.total}</span>
              </div>
              {connected && (
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 10 }}
                  onClick={() => handleManualPrint(order)}
                >
                  {alreadyPrinted ? "Print Again" : "Print Now"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        <strong>Activity</strong>
        {log.length === 0 && (
          <p style={{ fontSize: 13, color: "#666" }}>Nothing printed yet.</p>
        )}
        {log.map((entry, i) => (
          <div key={i} style={{ fontSize: 13, marginTop: 6 }}>
            <span style={{ color: "#666" }}>{entry.time}</span> — {entry.msg}
          </div>
        ))}
      </div>

      <a href="/" className="btn btn-secondary">
        Back
      </a>
    </div>
  );
}

export default function Home() {
  return (
    <div className="container">
      <h1>Restaurant Order System</h1>
      <div className="card">
        <p>Pick how this device is being used:</p>
        <a href="/waiter" className="btn btn-primary" style={{ marginBottom: 10 }}>
          Waiter — Take Orders
        </a>
        <a
          href="/print-station"
          className="btn btn-secondary"
          style={{ marginBottom: 10 }}
        >
          Print Station — Connect Printer
        </a>
        <a href="/admin" className="btn btn-secondary">
          Admin — Menu &amp; Tables
        </a>
      </div>
      <p style={{ fontSize: 13, color: "#666" }}>
        Set up each Bluetooth printer's phone by opening "Print Station" on
        that phone and connecting once. It will then auto-print every order
        as long as the tab stays open.
      </p>
    </div>
  );
}

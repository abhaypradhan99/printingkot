"use client";

// Builds a byte array of ESC/POS commands for a Zomato-style order slip.
// Works with standard 58mm/80mm ESC/POS Bluetooth thermal printers.

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function textToBytes(str) {
  return Array.from(new TextEncoder().encode(str));
}

function center(on) {
  return [ESC, 0x61, on ? 1 : 0];
}
function bold(on) {
  return [ESC, 0x45, on ? 1 : 0];
}
function doubleSize(on) {
  return [GS, 0x21, on ? 0x11 : 0x00];
}
function cut() {
  return [GS, 0x56, 0x00];
}
function init() {
  return [ESC, 0x40];
}
function feed(lines = 1) {
  const out = [];
  for (let i = 0; i < lines; i++) out.push(LF);
  return out;
}

const LINE_WIDTH = 32; // typical for 58mm printers; use 48 for 80mm

function padRow(left, right, width = LINE_WIDTH) {
  const space = Math.max(1, width - left.length - right.length);
  return left + " ".repeat(space) + right;
}

export function buildReceiptBytes({
  restaurantName = "Restaurant",
  tableName,
  orderId,
  items, // [{ name, qty, price }]
  createdAt,
}) {
  const bytes = [];
  const push = (arr) => bytes.push(...arr);

  push(init());
  push(center(true));
  push(bold(true));
  push(doubleSize(true));
  push(textToBytes(restaurantName + "\n"));
  push(doubleSize(false));
  push(bold(false));
  push(textToBytes("Order Slip\n"));
  push(center(false));
  push(textToBytes("-".repeat(LINE_WIDTH) + "\n"));

  push(textToBytes(`Table: ${tableName}\n`));
  push(textToBytes(`Order #: ${orderId}\n`));
  push(textToBytes(`Time: ${new Date(createdAt).toLocaleString()}\n`));
  push(textToBytes("-".repeat(LINE_WIDTH) + "\n"));

  push(bold(true));
  push(textToBytes(padRow("Item", "Qty  Amt") + "\n"));
  push(bold(false));
  push(textToBytes("-".repeat(LINE_WIDTH) + "\n"));

  let total = 0;
  for (const item of items) {
    const amount = item.qty * item.price;
    total += amount;
    push(textToBytes(item.name + "\n"));
    push(
      textToBytes(
        padRow("", `${item.qty} x ${item.price} = ${amount}`) + "\n"
      )
    );
  }

  push(textToBytes("-".repeat(LINE_WIDTH) + "\n"));
  push(bold(true));
  push(doubleSize(true));
  push(textToBytes(padRow("TOTAL", String(total)) + "\n"));
  push(doubleSize(false));
  push(bold(false));
  push(textToBytes("-".repeat(LINE_WIDTH) + "\n"));
  push(center(true));
  push(textToBytes("Thank you!\n"));
  push(feed(3));
  push(cut());

  return new Uint8Array(bytes);
}

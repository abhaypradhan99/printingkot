# Restaurant Order & Auto-Print System

Waiters take orders on a phone/tablet → order appears instantly in Firestore →
every connected print-station phone (with a Bluetooth thermal printer)
auto-prints a Zomato-style slip.

## How it's organized

- `/admin` — add/remove menu items and tables (dynamic table list)
- `/waiter` — pick a table, tap items, "Order Taken" sends the order
- `/print-station` — open this on each phone that has a Bluetooth printer
  attached. Tap "Connect Printer" once (pairs via Web Bluetooth), then leave
  the tab open — it listens for new orders in real time and prints them
  automatically, on both printer phones at once.

## 1. Create a free Firebase project

1. Go to https://console.firebase.google.com → **Add project** (free Spark
   plan is enough).
2. Inside the project: **Build → Firestore Database → Create database**
   (start in test mode for now).
3. **Project settings (gear icon) → General → Your apps → Add app → Web**.
   Register the app (no hosting needed) and copy the `firebaseConfig` values.
4. Paste those values into a `.env.local` file (copy `.env.local.example`)
   for local testing, and later into Vercel's Environment Variables.
5. In **Firestore → Rules**, paste the contents of `firestore.rules` from
   this project and click Publish. (It's intentionally open for the MVP —
   see "Adding real security" below before using this outside a trusted
   staff network.)

## 2. Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 on your computer to add a few menu items and
tables via `/admin` first.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **New Project → import the repo**.
3. Add the same environment variables from `.env.local` in Vercel's
   Project Settings → Environment Variables.
4. Deploy. Vercel gives you an `https://...vercel.app` URL — Web Bluetooth
   requires HTTPS, which this satisfies automatically.

## 4. Set up the two printer phones

On **each** Android phone with a Bluetooth thermal printer:

1. Turn the printer on and make sure it's in pairing/discoverable mode.
2. Open the deployed site in **Chrome** (not Samsung Internet or Firefox —
   Web Bluetooth support is inconsistent outside Chrome/Edge on Android).
3. Go to `/print-station`.
4. Tap **Connect Printer** → pick your printer from the list that pops up.
5. Leave that tab open. It will now auto-print every order placed by any
   waiter, in real time.

Repeat on the second phone with the second printer — both will print every
order.

Tip: "Add to Home Screen" in Chrome for each of these pages so staff can
open them like an app icon instead of typing a URL.

## 5. Everyday use

- Manager adds today's menu items and table names once via `/admin`.
- Waiters open `/waiter` on their phone/tablet, pick a table, tap items,
  tap **Order Taken — Send to Print**.
- Both printer stations print the slip within a second or two.

## Known limitations (please read)

- **Web Bluetooth only works in Chrome/Edge on Android.** It does not work
  on iPhones (Apple doesn't support Web Bluetooth in Safari) or in most
  in-app browsers.
- **The print-station tab must stay open and the phone awake.** If the
  phone's screen locks or the browser tab is closed, that station stops
  receiving orders until reopened. Consider keeping those two phones
  plugged in, screen-timeout set to "never", and Chrome pinned as a
  recent app. A wall-mounted phone holder next to each printer works well
  in practice.
- **Silent auto-reconnect on reload isn't 100% guaranteed** — Chrome's
  permission-persistence API for Bluetooth doesn't work identically on
  every Android version. If a print-station phone reboots or Chrome is
  fully closed, staff may need to tap **Connect Printer** again.
- **Printer compatibility:** this uses generic ESC/POS commands and scans
  for any writable Bluetooth characteristic, which covers most cheap
  58mm/80mm "mini printer" models. A few printer chipsets use a
  proprietary protocol instead of ESC/POS and won't work — if a printer
  connects but prints garbled text, let me know the printer model/brand
  and I can add support for it specifically.
- **Receipt width** is set for 58mm printers (32 characters per line) in
  `lib/receipt.js`. If yours is 80mm, change `LINE_WIDTH` to 48.

## Adding real security (recommended before wider rollout)

Right now `/admin`, `/waiter`, and `/print-station` are all open to anyone
with the URL, and Firestore rules allow open read/write. For a single
restaurant on a private URL that's usually an acceptable trade-off to keep
things simple — but if you want real protection:

- Add Firebase Authentication (email/password or phone OTP) and gate each
  route.
- Tighten `firestore.rules` to require `request.auth != null`.

Happy to add that layer in as a next step once the core flow is working
for you.

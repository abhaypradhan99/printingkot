import "./globals.css";

export const metadata = {
  title: "Restaurant Order & Print System",
  description: "Menu, tables, orders, and auto bill printing",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

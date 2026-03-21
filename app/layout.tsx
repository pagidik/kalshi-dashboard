import type { Metadata } from "next";
import "./globals.css";
import VisitorTracker from "../components/VisitorTracker";
import Header from "../components/Header";

export const metadata: Metadata = {
  title: "Kalshi Predictions Dashboard",
  description: "Tracking big money signals from Kalshi prediction markets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Header />
        {children}
        <VisitorTracker />
      </body>
    </html>
  );
}

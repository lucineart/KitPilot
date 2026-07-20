import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KitPilot — BeaverBot classroom packs",
  description:
    "Turn a BeaverBot STEAM kit into a ready-to-teach classroom pack.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

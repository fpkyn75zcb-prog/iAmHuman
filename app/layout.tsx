import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "iAmHuman Verification",
  description: "Verify an iAmHuman identity card.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

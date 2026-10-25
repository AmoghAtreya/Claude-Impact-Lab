import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Technician Intake",
  description:
    "Collect photos and answers from customers before a technician visits.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="bg-white text-neutral-950 antialiased">{children}</body>
    </html>
  );
}

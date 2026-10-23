import type { Metadata } from "next";
import { Archivo, Saira_Stencil } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const stencil = Saira_Stencil({
  variable: "--font-bss",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "TourScout — route your next tour on real fan taste",
  description:
    "An AI touring agent built on Qloo's taste graph: find the cities that over-index on your act, map fan hotspots and venues, and route a dated tour with co-bills, sponsors and pitches.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${stencil.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

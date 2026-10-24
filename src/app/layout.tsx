import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600"] });

// A second face with one job: the greeting on the first screen.
const serif = Source_Serif_4({ variable: "--font-serif-face", subsets: ["latin"], weight: ["600"] });

export const metadata: Metadata = {
  title: "TourScout: plan a first tour from who you sound like",
  description:
    "For emerging artists Google hasn't heard of yet. Name the acts you sound like and where you're based; TourScout uses their fans in Qloo's taste graph to plan your first run: cities, small rooms, acts to open for, brands to pitch.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}

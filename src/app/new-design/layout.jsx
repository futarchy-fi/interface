"use client";

import Providers from "../../providers/providers";
import { CurrencyProvider } from "../../contexts/CurrencyContext";
import { Oxanium, Barlow } from "next/font/google";

const oxanium = Oxanium({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-oxanium",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-barlow",
});

export default function NewDesignLayout({ children }) {
  return (
    <div className={`${oxanium.variable} ${barlow.variable} font-sans min-h-screen bg-black text-white`}>
      <Providers>
        <CurrencyProvider>
          {children}
        </CurrencyProvider>
      </Providers>
    </div>
  );
}

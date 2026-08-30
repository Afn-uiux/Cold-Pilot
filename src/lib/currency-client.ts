"use client";

import { useEffect, useState } from "react";
import { type Currency } from "@/lib/currency";

function currencyFromCookie(): Currency | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)cc=(NGN|USD)/);
  return match ? (match[1] as Currency) : null;
}

function currencyFromTimezone(): Currency {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === "Africa/Lagos"
      ? "NGN"
      : "USD";
  } catch {
    return "NGN";
  }
}

export function getClientCurrency(): Currency {
  return currencyFromCookie() ?? currencyFromTimezone();
}

export function useCurrency(): Currency {
  const [currency, setCurrency] = useState<Currency>("NGN");

  useEffect(() => {
    setCurrency(getClientCurrency());
  }, []);

  return currency;
}
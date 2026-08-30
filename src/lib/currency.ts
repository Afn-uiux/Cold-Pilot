export const USD_NAIRA_RATE = 1500;

export type Currency = "NGN" | "USD";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function currencyFromCountry(country: string | null | undefined): Currency {
  return country?.toUpperCase() === "NG" ? "NGN" : "USD";
}

export function currencyFromHeaders(headers: Headers): Currency {
  const country = headers.get("cf-ipcountry") ?? headers.get("x-vercel-ip-country");
  if (!country) return "NGN";
  return currencyFromCountry(country);
}

export function formatPrice(priceNgn: number, currency: Currency): string {
  if (currency === "NGN") return `₦${priceNgn.toLocaleString()}`;
  const usd = round2(priceNgn / USD_NAIRA_RATE);
  const amount = usd % 1 === 0 ? usd.toLocaleString() : usd.toFixed(2).replace(/\.?0+$/, "");
  return `$${amount}`;
}
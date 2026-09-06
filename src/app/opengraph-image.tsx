import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Coldpilot — cold email that lands in the inbox";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#101928";
const BLUE = "#2563EB";
const CREAM = "#F0F4F8";
const MUTED = "#5B6577";

type FontFace = { name: string; data: ArrayBuffer; weight: 400 };

async function loadFont(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength === 0) throw new Error("empty font");
  return buf;
}

const Card = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "64px 72px",
      background: CREAM,
      color: INK,
      fontFamily: "Geist, system-ui, sans-serif",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: BLUE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF",
          fontSize: 30,
          fontWeight: 600,
        }}
      >
        C
      </div>
      <div
        style={{
          fontSize: 40,
          fontFamily: "Instrument Serif, Georgia, serif",
          letterSpacing: "-0.5px",
        }}
      >
        Coldpilot
      </div>
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 980 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 72,
          lineHeight: 1.08,
          fontFamily: "Instrument Serif, Georgia, serif",
          letterSpacing: "-1px",
        }}
      >
        Cold email that
        <br />
        lands in the inbox.
      </div>
      <div style={{ fontSize: 28, color: MUTED, maxWidth: 800, lineHeight: 1.4 }}>
        Warm-up, rotation, reply detection, verification and analytics — all in
        one place.
      </div>
    </div>

    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 22,
        color: BLUE,
        borderTop: "1px solid #D7DEE9",
        paddingTop: 28,
      }}
    >
      <span>usecoldpilot.com</span>
      <span style={{ color: MUTED }}>Cold email, done properly</span>
    </div>
  </div>
);

export default async function OpenGraphImage() {
  const fonts: FontFace[] = [] as FontFace[];
  try {
    const [serif, geist] = await Promise.all([
      loadFont("https://cdn.jsdelivr.net/fontsource/fonts/instrument-serif@latest/latin-400-normal.woff"),
      loadFont("https://cdn.jsdelivr.net/fontsource/fonts/geist@latest/latin-400-normal.woff"),
    ]);
    fonts.push(
      { name: "Instrument Serif", data: serif, weight: 400 },
      { name: "Geist", data: geist, weight: 400 }
    );
  } catch {
    // Fonts are cosmetic; fall back to system fonts if unavailable.
  }

  try {
    return new ImageResponse(<Card />, {
      ...size,
      fonts: fonts.length ? fonts : undefined,
    });
  } catch (err) {
    console.error("[og-image] render with fonts failed, retrying without:", err);
    return new ImageResponse(<Card />, { ...size });
  }
}
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// JobPilot mark: paper-plane / send arrow on emerald, evoking
// "applications flying out". Same shape proportions as the rest of
// Ali's PWA suite (rounded square, central glyph).
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#059669",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M3 11 L21 3 L13 21 L11 13 L3 11 Z" fill="white" />
          <path d="M11 13 L21 3" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size },
  );
}

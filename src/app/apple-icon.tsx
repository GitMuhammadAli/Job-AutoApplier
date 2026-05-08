import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#059669",
          borderRadius: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="110" height="110" viewBox="0 0 24 24" fill="none">
          <path d="M3 11 L21 3 L13 21 L11 13 L3 11 Z" fill="white" />
          <path d="M11 13 L21 3" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size },
  );
}

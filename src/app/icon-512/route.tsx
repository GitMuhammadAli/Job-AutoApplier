import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "#059669",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="320" height="320" viewBox="0 0 24 24" fill="none">
          <path d="M3 11 L21 3 L13 21 L11 13 L3 11 Z" fill="white" />
          <path d="M11 13 L21 3" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { width: 512, height: 512 },
  );
}

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Verbatim mirror of alishahid-dev portfolio apple-icon — Ali's craftsperson mark.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#fafafa",
          borderRadius: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui",
          color: "#09090b",
          fontSize: 88,
          fontWeight: 800,
          letterSpacing: -3,
          position: "relative",
          border: "2px solid rgba(0,0,0,0.10)",
        }}
      >
        AS
        <div
          style={{
            position: "absolute",
            right: 22,
            bottom: 22,
            width: 18,
            height: 18,
            borderRadius: 18,
            background: "#0ea5e9",
          }}
        />
      </div>
    ),
    { ...size },
  );
}

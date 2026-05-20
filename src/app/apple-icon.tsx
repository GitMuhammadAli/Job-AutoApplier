import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// JP monogram apple-icon, emerald JobPilot brand.
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
          fontFamily: "system-ui",
          color: "#fafafa",
          fontSize: 88,
          fontWeight: 800,
          letterSpacing: -3,
          position: "relative",
        }}
      >
        JP
        <div
          style={{
            position: "absolute",
            right: 22,
            bottom: 22,
            width: 18,
            height: 18,
            borderRadius: 18,
            background: "#fafafa",
          }}
        />
      </div>
    ),
    { ...size },
  );
}

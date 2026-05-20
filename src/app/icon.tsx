import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// JP monogram, emerald JobPilot brand.
// Same craft pattern as alishahid-dev portfolio: rounded square + monogram + accent dot.
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
          fontFamily: "system-ui",
          color: "#fafafa",
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: -0.5,
          position: "relative",
        }}
      >
        JP
        <div
          style={{
            position: "absolute",
            right: 4,
            bottom: 4,
            width: 4,
            height: 4,
            borderRadius: 4,
            background: "#fafafa",
          }}
        />
      </div>
    ),
    { ...size },
  );
}

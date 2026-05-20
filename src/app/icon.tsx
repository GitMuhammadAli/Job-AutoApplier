import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Verbatim mirror of alishahid-dev portfolio icon — Ali's craftsperson mark.
// White/zinc background, dark "AS", sky-blue accent dot.
// (next/og can't read prefers-color-scheme; defaulting to light. SVG favicon
// handles dark mode via favicon.svg.)
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#fafafa",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui",
          color: "#09090b",
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: -0.5,
          position: "relative",
          border: "1px solid rgba(0,0,0,0.10)",
        }}
      >
        AS
        <div
          style={{
            position: "absolute",
            right: 4,
            bottom: 4,
            width: 4,
            height: 4,
            borderRadius: 4,
            background: "#0ea5e9",
          }}
        />
      </div>
    ),
    { ...size },
  );
}

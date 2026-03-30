import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f1117",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        gap: "1rem",
      }}
    >
      <h1 style={{ fontSize: "4rem", fontWeight: 800, margin: 0, color: "#7dd3fc" }}>404</h1>
      <p style={{ margin: 0, opacity: 0.7 }}>This page could not be found.</p>
      <Link
        href="/"
        style={{
          marginTop: "0.5rem",
          padding: "0.6rem 1.25rem",
          borderRadius: "0.75rem",
          background: "rgba(125,211,252,0.15)",
          border: "1px solid rgba(125,211,252,0.4)",
          color: "#7dd3fc",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Go home
      </Link>
    </div>
  );
}

"use client";

/**
 * Root-level error boundary. Must stay self-contained (no Providers / contexts)
 * because it replaces the root layout when active.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#0f1117",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ padding: "2rem", maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ marginTop: "0.75rem", opacity: 0.85, fontSize: "0.9rem" }}>
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "1.25rem",
              padding: "0.6rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(125,211,252,0.4)",
              background: "rgba(125,211,252,0.12)",
              color: "#7dd3fc",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

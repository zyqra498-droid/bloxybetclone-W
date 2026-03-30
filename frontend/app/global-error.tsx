"use client";

/**
 * Root error UI — keep imports minimal (no @/ paths) so prerender does not pull in app contexts.
 * Replaces the root layout when active; must include <html> and <body>.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", background: "#0f1117", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ padding: "2rem" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700 }}>Something went wrong</h1>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
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

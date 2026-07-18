"use client";

/**
 * Admin-wide error boundary. The most common cause of a crash here is a
 * stale tab after a deployment: server-action IDs rotate on every deploy, so
 * a button clicked on an old page throws "Failed to find Server Action"
 * before any handler runs. Instead of Next's opaque white "Application
 * error" screen, explain and offer the one-click fix.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", padding: "0 20px" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔌</div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>That didn&apos;t go through</h1>
      <p style={{ fontSize: 14, color: "#56627A", lineHeight: 1.6, margin: "0 0 6px" }}>
        This usually means the page was open from before the latest site update, so the button pointed at
        an older version of the server. Reloading fixes it; your data is safe and nothing was half-done.
      </p>
      {error?.digest && <p style={{ fontSize: 11, color: "#A0A7B5", fontFamily: "monospace", margin: "0 0 18px" }}>ref {error.digest}</p>}
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button
          onClick={() => window.location.reload()}
          style={{ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 13.5, border: "none", padding: "11px 22px", borderRadius: 10, cursor: "pointer" }}
        >
          Reload this page
        </button>
        <button
          onClick={() => reset()}
          style={{ background: "#fff", color: "#3A4358", fontWeight: 600, fontSize: 13.5, border: "1px solid #E0E4ED", padding: "11px 18px", borderRadius: 10, cursor: "pointer" }}
        >
          Try again without reloading
        </button>
      </div>
    </div>
  );
}

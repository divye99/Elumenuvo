/** Instant skeleton while the workspace loads its data. Without this, the
 *  post-signin navigation showed a frozen page for seconds and felt broken. */
export default function AppLoading() {
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, height: 108 };
  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "#F5F6F9" }}>
      <div style={{ width: 224, flex: "none", background: "#161D2B" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ height: 64, background: "#fff", borderBottom: "1px solid #E8EBF1", display: "flex", alignItems: "center", padding: "0 28px", gap: 10 }}>
          <div style={{ width: 140, height: 16, borderRadius: 6, background: "#EEF0F4", animation: "elumePulse 1.2s ease-in-out infinite" }} />
        </div>
        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 15, marginBottom: 18 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ ...card, animation: `elumePulse 1.2s ease-in-out ${i * 0.12}s infinite` }} />
            ))}
          </div>
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, height: 280, animation: "elumePulse 1.2s ease-in-out .5s infinite" }} />
          <div style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: "#8A93A6" }}>Opening your workspace…</div>
        </div>
      </div>
      <style>{`@keyframes elumePulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }`}</style>
    </div>
  );
}

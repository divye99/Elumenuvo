"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewImport, applyImport } from "@/lib/admin/actions";

type Diff = {
  action: "add" | "update" | "remove";
  id: string;
  summary: string;
  changes: { field: string; from: string; to: string }[];
  payload: Record<string, unknown> | null;
};

const BADGE: Record<Diff["action"], { bg: string; fg: string; label: string }> = {
  add: { bg: "#E6F5EE", fg: "#137a4b", label: "Add" },
  update: { bg: "#EEF0FE", fg: "#3a41b5", label: "Update" },
  remove: { bg: "#FBE9E4", fg: "#9a3b16", label: "Remove" },
};

export default function ImportClient() {
  const router = useRouter();
  const [filename, setFilename] = useState("");
  const [diffs, setDiffs] = useState<Diff[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  // Bring the result banner into view: after a long list of diffs it can
  // otherwise land off-screen and look like nothing happened.
  useEffect(() => {
    if (done) doneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [done]);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setFilename(file.name);
    setDone(null);
    setReading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result ?? "");
      try {
        const res = await previewImport(text);
        setDiffs(res.diffs as Diff[]);
        setErrors(res.errors);
      } catch {
        setErrors(["Couldn't read that file. Make sure it's the CSV exported from here."]);
      } finally {
        setReading(false);
      }
    };
    reader.readAsText(file);
  };

  const confirm = async () => {
    if (!diffs?.length || applying) return;
    setApplying(true);
    setErrors([]);
    try {
      const res = await applyImport(
        diffs.map((d) => ({ action: d.action, id: d.id, summary: d.summary, payload: d.payload })),
        filename || "import.csv"
      );
      if (res.ok) {
        // Show the result immediately, THEN refresh the server data. Previously
        // router.refresh() ran inside the same transition, so the button stayed
        // stuck on "Applying…" for as long as the (heavy) admin page took to
        // re-render. It looked like nothing had happened.
        setDone(`Applied ${res.applied} change${res.applied === 1 ? "" : "s"}. The catalogue is updated.`);
        setDiffs(null);
        setFilename("");
        startRefresh(() => router.refresh());
      } else {
        setErrors([res.error]);
      }
    } catch (e) {
      setErrors([
        e instanceof Error && e.message
          ? `The import didn't complete: ${e.message}. Re-check the catalogue before retrying.`
          : "The import didn't complete. Re-check the catalogue before retrying: some rows may already have been saved.",
      ]);
    } finally {
      setApplying(false);
    }
  };

  const counts = diffs
    ? diffs.reduce((a, d) => ((a[d.action] = (a[d.action] ?? 0) + 1), a), {} as Record<string, number>)
    : {};

  return (
    <div>
      {/* Step 1: download */}
      <Section n={1} title="Download a spreadsheet">
        <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 12px", lineHeight: 1.5 }}>
          Get the current catalogue (every product pre-filled, ready to edit) or a blank template. The first
          column is <b>action</b>. Put <code>Update</code>, <code>Add</code> or <code>Remove</code> on each row you want
          to change; leave it blank to skip that row. Opens in Excel / Google Sheets.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="/admin/products/export" style={btnPrimary}>⬇ Download full catalogue (.csv)</a>
          <a href="/admin/products/export?sample=1" style={btnGhost}>⬇ Blank template</a>
        </div>
      </Section>

      {/* Step 2: upload */}
      <Section n={2} title="Upload your edited spreadsheet">
        <label style={{ display: "block", border: "1.5px dashed #C9CFDB", borderRadius: 12, padding: "26px 20px", textAlign: "center", cursor: "pointer", background: "#FBFCFE" }}>
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} style={{ display: "none" }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#19202e" }}>{filename || "Choose a .csv file"}</div>
          <div style={{ fontSize: 12, color: "#8A93A6", marginTop: 4 }}>We&apos;ll show a preview of every change before anything is saved.</div>
        </label>
        {reading && <div style={{ fontSize: 13, color: "#8A93A6", marginTop: 10 }}>Reading…</div>}
      </Section>

      {done && (
        <div ref={doneRef} style={{ background: "#E6F5EE", color: "#137a4b", borderRadius: 12, padding: "14px 16px", fontSize: 14, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span>✓ {done}</span>
          {refreshing && <span style={{ fontWeight: 500, fontSize: 12.5, opacity: 0.8 }}>Refreshing the table…</span>}
        </div>
      )}

      {errors.length > 0 && (
        <div style={{ background: "#FBE9E4", color: "#9a3b16", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>{errors.length} issue{errors.length === 1 ? "" : "s"}, fix these rows and re-upload:</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
            {errors.slice(0, 40).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Step 3: preview + confirm */}
      {diffs && (
        <Section n={3} title="Review changes">
          {diffs.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "#8A93A6" }}>No changes detected in the file.</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {(["add", "update", "remove"] as const).map((a) =>
                  counts[a] ? (
                    <span key={a} style={{ fontSize: 12.5, fontWeight: 700, background: BADGE[a].bg, color: BADGE[a].fg, padding: "5px 11px", borderRadius: 9 }}>
                      {counts[a]} {BADGE[a].label.toLowerCase()}{counts[a] === 1 ? "" : "s"}
                    </span>
                  ) : null
                )}
              </div>

              <div style={{ border: "1px solid #E8EBF1", borderRadius: 12, overflow: "hidden", maxHeight: "50vh", overflowY: "auto" }}>
                {diffs.map((d, i) => {
                  const b = BADGE[d.action];
                  return (
                    <div key={d.id + i} style={{ padding: "12px 14px", borderTop: i ? "1px solid #F0F2F6" : undefined, display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, background: b.bg, color: b.fg, padding: "3px 9px", borderRadius: 7, flex: "none", minWidth: 54, textAlign: "center" }}>{b.label}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#19202e" }}>{d.summary}</div>
                        {d.changes.length > 0 && (
                          <div style={{ fontSize: 12, color: "#56627A", marginTop: 4, display: "flex", flexWrap: "wrap", gap: "2px 14px" }}>
                            {d.changes.map((c) => (
                              <span key={c.field}>
                                <b style={{ color: "#8A93A6", fontWeight: 600 }}>{c.field}:</b> <span style={{ textDecoration: "line-through", color: "#A0A7B5" }}>{c.from || "-"}</span> → <span style={{ color: "#137a4b", fontWeight: 600 }}>{c.to || "-"}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
                <button onClick={confirm} disabled={applying} style={{ ...btnPrimary, background: "#4E5BDC", cursor: applying ? "default" : "pointer", opacity: applying ? 0.7 : 1 }}>
                  {applying ? `Applying ${diffs.length} change${diffs.length === 1 ? "" : "s"}…` : `Apply ${diffs.length} change${diffs.length === 1 ? "" : "s"}`}
                </button>
                <button onClick={() => { setDiffs(null); setErrors([]); setFilename(""); }} disabled={applying} style={{ background: "none", border: "none", color: "#56627A", fontSize: 13.5, cursor: "pointer" }}>Cancel</button>
                {applying && <span style={{ fontSize: 12.5, color: "#8A93A6" }}>Saving to the catalogue, don&apos;t close this page.</span>}
              </div>
            </>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "20px 22px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#161D2B", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{n}</span>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

const btnPrimary: React.CSSProperties = { background: "#161D2B", color: "#fff", fontWeight: 600, fontSize: 13.5, padding: "10px 18px", borderRadius: 10, border: "none", textDecoration: "none", display: "inline-block", cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "#fff", color: "#19202e", fontWeight: 600, fontSize: 13.5, padding: "10px 18px", borderRadius: 10, border: "1px solid #E0E4ED", textDecoration: "none", display: "inline-block" };

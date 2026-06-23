import { login } from "@/lib/admin/actions";
import { isAdmin } from "@/lib/admin/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAdmin()) redirect("/admin");
  const { error } = await searchParams;
  const msg =
    error === "invalid" ? "Wrong password." :
    error === "unconfigured" ? "ADMIN_PASSWORD is not set on the server." :
    null;

  return (
    <div style={{ maxWidth: 360, margin: "60px auto 0", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 28 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Admin sign in</h1>
      <p style={{ fontSize: 13, color: "#8A93A6", margin: "0 0 18px" }}>Enter the admin password to manage products & content.</p>
      <form action={login}>
        <input
          type="password"
          name="password"
          placeholder="Admin password"
          autoFocus
          required
          style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E0E4ED", borderRadius: 10, padding: "11px 13px", fontSize: 14, outline: "none" }}
        />
        {msg && <p style={{ color: "#E0612A", fontSize: 12.5, margin: "10px 0 0" }}>{msg}</p>}
        <button style={{ width: "100%", marginTop: 14, background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 14, border: "none", padding: "11px", borderRadius: 10, cursor: "pointer" }}>
          Sign in
        </button>
      </form>
    </div>
  );
}

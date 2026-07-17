import { adminClient } from "@/lib/supabase/admin";

/** Registered accounts (auth.users joined with profiles) for the admin
 *  Signups page and its CSV export. Service role only. */
export type Signup = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  name: string | null;
  phone: string | null;
  account_type: string | null;
  company: string | null;
  gstin: string | null;
};

export async function loadSignups(): Promise<Signup[]> {
  const db = adminClient();
  if (!db) return [];
  const users: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    users.push(...data.users);
    if (data.users.length < 200) break;
  }
  const { data: profiles } = await db.from("profiles").select("id, full_name, phone, account_type, company, gstin");
  const pby = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  return users
    .map((u) => {
      const p = pby.get(u.id) ?? {};
      return {
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        confirmed: !!u.email_confirmed_at,
        name: p.full_name ?? u.user_metadata?.full_name ?? null,
        phone: p.phone ?? u.user_metadata?.phone ?? null,
        account_type: p.account_type ?? "personal",
        company: p.company ?? null,
        gstin: p.gstin ?? null,
      };
    })
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}


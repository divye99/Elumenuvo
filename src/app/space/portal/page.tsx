import type { Metadata } from "next";
import { LogOut, Package, Inbox } from "lucide-react";
import Nav from "@/components/space/Nav";
import Footer from "@/components/space/Footer";
import SignIn from "@/components/space/portal/SignIn";
import NewRequestForm from "@/components/space/portal/NewRequestForm";
import QuoteForm from "@/components/space/portal/QuoteForm";
import { StatusBadge, StatusRail } from "@/components/space/portal/StatusBadge";
import { createClient } from "@/lib/space/supabase/server";

export const metadata: Metadata = {
  title: "Portal",
  description: "Elumenuvo client & supplier portal.",
};

type RequestRow = {
  id: number;
  item: string;
  quantity: string | null;
  target_date: string | null;
  notes: string | null;
  company: string | null;
  status: string;
  created_at: string;
  user_id: string;
};

type QuoteRow = {
  id: number;
  request_id: number;
  price: string | null;
  lead_time: string | null;
  notes: string | null;
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PortalPage() {
  let user = null;
  try {
    const supabase = await createClient();
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    user = u;
  } catch {
    // env not configured — fall through to sign-in screen
  }

  /* ---------- signed out ---------- */
  if (!user) {
    return (
      <>
        <Nav />
        <main className="flex min-h-[70vh] items-center justify-center bg-navy-deep px-6 py-20 text-white">
          <div className="w-full max-w-md">
            <h1 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              Sign in to the portal
            </h1>
            <p className="mt-2 mb-8 text-center text-white/60">
              Submit procurement requests and track them end to end.
            </p>
            <SignIn />
          </div>
        </main>
        <Footer />
      </>
    );
  }

  /* ---------- signed in ---------- */
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "client";
  const isSupplier = role === "supplier" || role === "admin";

  const { data: requests } = await supabase
    .from("procurement_requests")
    .select("*")
    .order("created_at", { ascending: false });

  const reqList = (requests ?? []) as RequestRow[];

  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, request_id, price, lead_time, notes");
  const quoteList = (quotes ?? []) as QuoteRow[];
  const quotesByRequest = new Map<number, QuoteRow[]>();
  for (const q of quoteList) {
    quotesByRequest.set(q.request_id, [
      ...(quotesByRequest.get(q.request_id) ?? []),
      q,
    ]);
  }

  return (
    <>
      <Nav />
      <main className="min-h-[70vh] bg-slate-50">
        {/* Portal header */}
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-navy">
                {isSupplier ? "Supplier portal" : "Your requests"}
              </h1>
              <p className="text-sm text-slate-500">
                {user.email}
                {isSupplier && (
                  <span className="ml-2 rounded bg-navy px-1.5 py-0.5 text-[11px] font-medium text-white">
                    {role}
                  </span>
                )}
              </p>
            </div>
            <form action="/space/auth/signout" method="post">
              <button className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-ring">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-6 py-8">
          {!isSupplier && (
            <div className="mb-8">
              <NewRequestForm defaultCompany={profile?.company} />
            </div>
          )}

          {reqList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              {isSupplier ? (
                <Inbox className="mx-auto h-8 w-8 text-slate-300" />
              ) : (
                <Package className="mx-auto h-8 w-8 text-slate-300" />
              )}
              <p className="mt-3 font-medium text-navy">
                {isSupplier ? "No open requests yet." : "No requests yet."}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {isSupplier
                  ? "Client requests will appear here for you to quote."
                  : "Submit your first procurement request above."}
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {reqList.map((r) => {
                const rQuotes = quotesByRequest.get(r.id) ?? [];
                return (
                  <li
                    key={r.id}
                    className="rounded-2xl bg-white p-6 ring-1 ring-slate-200"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-navy">{r.item}</h3>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {[
                            r.quantity,
                            r.company,
                            r.target_date
                              ? `needed by ${fmtDate(r.target_date)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>

                    {r.notes && (
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">
                        {r.notes}
                      </p>
                    )}

                    {!isSupplier && <StatusRail status={r.status} />}

                    <p className="mt-3 text-xs text-slate-400">
                      Requested {fmtDate(r.created_at)}
                    </p>

                    {/* Quotes */}
                    {rQuotes.length > 0 && (
                      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {isSupplier ? "Your quotes" : "Quotes received"}
                        </p>
                        {rQuotes.map((q) => (
                          <div
                            key={q.id}
                            className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
                          >
                            {[q.price, q.lead_time, q.notes]
                              .filter(Boolean)
                              .join(" · ") || "Quote submitted"}
                          </div>
                        ))}
                      </div>
                    )}

                    {isSupplier && <QuoteForm requestId={r.id} />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

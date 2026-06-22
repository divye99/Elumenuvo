"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/space/catalogue", label: "What we source" },
  { href: "/space/about", label: "About" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-deep/90 backdrop-blur supports-[backdrop-filter]:bg-navy-deep/75">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/space"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-white focus-ring rounded"
        >
          <span
            className="inline-block h-2 w-2 rounded-full bg-accent"
            aria-hidden="true"
          />
          Elumenuvo
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-white/70 transition-colors hover:text-white focus-ring rounded"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/space/portal"
            className="text-sm font-medium text-white/70 transition-colors hover:text-white focus-ring rounded"
          >
            Sign in
          </Link>
          <Link
            href="/space#waitlist"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus-ring"
          >
            Join the waitlist
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-white sm:hidden focus-ring rounded p-1"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-white/10 bg-navy-deep px-6 py-4 sm:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 text-base font-medium text-white/80 hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/space/portal"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2.5 text-base font-medium text-white/80 hover:bg-white/5 hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/space#waitlist"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-lg bg-accent px-4 py-3 text-center text-base font-semibold text-white hover:bg-accent-hover"
            >
              Join the waitlist
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

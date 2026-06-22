import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-navy text-white/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          Elumenuvo · India ·{" "}
          <a
            href="mailto:info@elumenuvo.com"
            className="text-white/80 underline-offset-4 hover:text-white hover:underline focus-ring rounded"
          >
            info@elumenuvo.com
          </a>
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/space/catalogue" className="hover:text-white">
            What we source
          </Link>
          <Link href="/space/about" className="hover:text-white">
            About
          </Link>
          <Link href="/space/portal" className="hover:text-white">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { Zap } from "lucide-react";
import { TryDemoButton } from "@/components/marketing/TryDemoButton";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Zap className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">ELUME</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <Link href="/how-it-works" className="hover:text-foreground">How it works</Link>
            <Link href="/about" className="hover:text-foreground">About</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </nav>
          <TryDemoButton className="px-4 py-2 text-sm">Try the live demo</TryDemoButton>
        </div>
      </header>

      {children}

      <footer className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Zap className="h-4 w-4" />
                </div>
                <span className="font-bold tracking-tight">ELUME</span>
              </div>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                India&apos;s dedicated B2B procurement platform for Fast-Moving Electrical Goods.
              </p>
            </div>
            <div className="flex gap-12 text-sm">
              <div className="space-y-2">
                <div className="font-semibold">Product</div>
                <Link href="/how-it-works" className="block text-muted-foreground hover:text-foreground">How it works</Link>
                <Link href="/contact" className="block text-muted-foreground hover:text-foreground">Talk to us</Link>
              </div>
              <div className="space-y-2">
                <div className="font-semibold">Company</div>
                <Link href="/about" className="block text-muted-foreground hover:text-foreground">About</Link>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t pt-6 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Elume Nuvotech Private Limited. Demo figures are illustrative.
          </div>
        </div>
      </footer>
    </div>
  );
}

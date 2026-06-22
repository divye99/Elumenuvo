// The landing (Landing.tsx) ships its own nav + footer, so this layout is a
// pass-through. Secondary marketing pages render inside it directly.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

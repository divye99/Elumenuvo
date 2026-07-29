import { Sk, SkLines } from "@/components/storefront/Skeleton";

/** Blog-post skeleton: the 760px article column - title, meta, paragraphs. */
export default function PostLoading() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 70px" }}>
      <Sk h={12} w={140} r={5} />
      <div style={{ height: 14 }} />
      <Sk h={34} r={9} />
      <div style={{ height: 8 }} />
      <Sk h={34} w="70%" r={9} />
      <div style={{ height: 14 }} />
      <Sk h={12} w={220} r={5} />
      <div style={{ height: 28 }} />
      <SkLines n={4} h={14} gap={11} lastW="85%" />
      <div style={{ height: 22 }} />
      <Sk h={220} r={14} />
      <div style={{ height: 22 }} />
      <SkLines n={6} h={14} gap={11} lastW="60%" />
    </main>
  );
}

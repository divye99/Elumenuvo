import Landing from "@/components/landing/Landing";
import { getSiteContent } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function Page() {
  const content = await getSiteContent();
  return <Landing content={content} />;
}

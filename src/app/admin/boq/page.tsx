import { requireAdmin } from "@/lib/admin/auth";
import BoqAssistant from "@/components/app/BoqAssistant";

/** Admin → BOQ: run Smart BOM on a customer's behalf (owner ask, Aug 2026:
 *  "somebody has sent an enquiry and I have to fulfill it"). Same matcher
 *  and learning loop as /app/boq; the finish line is the cart-link builder
 *  instead of a cart push. */
export const dynamic = "force-dynamic";

export default async function AdminBoqPage() {
  await requireAdmin();
  return <BoqAssistant admin />;
}

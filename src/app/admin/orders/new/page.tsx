import { requireAdmin } from "@/lib/admin/auth";
import CustomOrderBuilder from "@/components/admin/CustomOrderBuilder";

/** Admin → Orders → New: record a phone/WhatsApp order for customised or
 *  off-catalogue products at an admin-set price. Lands in the same orders
 *  table as web orders (owner ask, Aug 2026). */
export const dynamic = "force-dynamic";

export default async function AdminNewOrderPage() {
  await requireAdmin();
  return <CustomOrderBuilder />;
}

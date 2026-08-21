import { requireAdmin } from "@/lib/admin/auth";
import QuotationBuilder from "@/components/admin/QuotationBuilder";

/** Admin → Quotation: turn an enquiry (customer email + RFQ lines) into the
 *  standard Elume quotation as an editable .docx (owner spec, Aug 2026).
 *  Reached directly or from the Smart BOM console's approved lines. */
export const dynamic = "force-dynamic";

export default async function AdminQuotationPage() {
  await requireAdmin();
  return <QuotationBuilder />;
}

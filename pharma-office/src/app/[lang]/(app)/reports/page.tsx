import { AccessDenied } from "@/components/data/access-denied";
import { PlannedModule } from "@/components/data/planned-module";
import { pageContext } from "@/lib/page-context";

export default async function ReportsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { t, allowed } = await pageContext(params, "reports.view");
  if (!allowed) return <AccessDenied t={t} />;
  return <PlannedModule title={t.nav.reports} phaseLabel={t.common.planned} items={t.planned.reports} t={t} />;
}

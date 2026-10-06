import { AccessDenied } from "@/components/data/access-denied";
import { PlannedModule } from "@/components/data/planned-module";
import { interpolate } from "@/lib/i18n/config";
import { pageContext } from "@/lib/page-context";

export default async function RisksPage({ params }: { params: Promise<{ lang: string }> }) {
  const { t, allowed } = await pageContext(params, "risks.view");
  if (!allowed) return <AccessDenied t={t} />;
  return <PlannedModule title={t.nav.risks} phaseLabel={interpolate(t.common.plannedPhase, { n: 5 })} items={t.planned.risks} t={t} />;
}

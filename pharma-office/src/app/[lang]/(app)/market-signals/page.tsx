import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AccessDenied } from "@/components/data/access-denied";
import { ConfidenceBadge, SourceBadge } from "@/components/data/badges";
import { Notice, PageHeader } from "@/components/data/page-header";
import { Pagination } from "@/components/data/pagination";
import { can } from "@/lib/auth/permissions";
import { exact, formatDate, loc } from "@/lib/format";
import { pageContext, readSearch } from "@/lib/page-context";
import { listSignals, signalFiltersSchema, SIGNALS_PAGE_SIZE } from "@/server/queries/admin";

export default async function MarketSignalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t, user, allowed } = await pageContext(params, "signals.view");
  if (!allowed) return <AccessDenied t={t} />;
  const { page } = signalFiltersSchema.parse(await readSearch(searchParams));
  const { rows, total } = await listSignals(user, page);
  const linkDrugstores = can(user, "drugstores.view");

  return (
    <div className="space-y-4">
      <PageHeader title={t.signals.title} subtitle={t.signals.subtitle} badges={<SourceBadge source="reported" t={t} />} />
      <Notice tone="phase">{t.signals.phaseNote}</Notice>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title={t.signals.empty} />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((s) => (
              <li key={s.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="reported">{t.signalCategory[s.category]}</Badge>
                  <SourceBadge source={s.sourceType} t={t} />
                  <ConfidenceBadge level={s.confidence} t={t} />
                  <Badge tone={s.status === "open" ? "warn" : "neutral"}>{t.signals.status[s.status]}</Badge>
                </div>
                <p className="mt-1.5 text-sm text-ink">{s.observation}</p>
                <p className="mt-1 text-xs text-muted">
                  {formatDate(s.signalDate, locale)}
                  {" · "}
                  {loc(locale, s.reporterName, s.reporterNameAr)}
                  {s.reporterRole ? ` (${t.roles[s.reporterRole]})` : ""}
                  {s.productName ? ` · ${loc(locale, s.productName, s.productNameAr)}` : ""}
                  {s.drugstoreId ? (
                    <>
                      {" · "}
                      {linkDrugstores ? (
                        <Link className="hover:underline" href={`/${locale}/drugstores/${s.drugstoreId}`}>
                          {loc(locale, s.drugstoreName, s.drugstoreNameAr)}
                        </Link>
                      ) : (
                        loc(locale, s.drugstoreName, s.drugstoreNameAr)
                      )}
                    </>
                  ) : null}
                  {s.territoryEn ? ` · ${loc(locale, s.territoryEn, s.territoryAr)}` : ""}
                  {s.city ? ` · ${s.city}` : ""}
                  {s.observedPrice ? (
                    <>
                      {" · "}
                      {t.signals.price}: <span className="num">{exact(s.observedPrice)}</span> {t.common.iqdColumn}
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Pagination basePath={`/${locale}/market-signals`} params={{}} page={page} pageSize={SIGNALS_PAGE_SIZE} total={total} t={t} />
      </Card>
    </div>
  );
}

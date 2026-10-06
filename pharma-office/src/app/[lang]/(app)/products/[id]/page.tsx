import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AccessDenied } from "@/components/data/access-denied";
import { SourceBadge } from "@/components/data/badges";
import { BarSeries } from "@/components/data/charts";
import { Notice, PageHeader, Stat } from "@/components/data/page-header";
import { can } from "@/lib/auth/permissions";
import { addMonths, daysBetween, startOfMonth } from "@/lib/domain/dates";
import { exact, formatDate, formatMonth, loc, money } from "@/lib/format";
import { pageContext } from "@/lib/page-context";
import { getProduct } from "@/server/queries/products";

export default async function ProductPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { locale, t, user, today, allowed } = await pageContext(params, "products.view");
  if (!allowed) return <AccessDenied t={t} />;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const data = await getProduct(user, id, today);
  if (!data) return <EmptyState title={t.products.notFound} />;
  const { product: p } = data;
  const showSales = can(user, "financials.view");
  const m = (v: number) => money(v, locale);
  const byMonth = new Map(data.monthly.map((x) => [x.month, x.value]));
  const from = startOfMonth(addMonths(startOfMonth(today), -12));
  const series = Array.from({ length: 13 }, (_, i) => {
    const key = startOfMonth(addMonths(from, i));
    return { key, value: byMonth.get(key) ?? 0 };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={loc(locale, p.name, p.nameAr)}
        subtitle={`${p.genericName} · ${p.strength ?? ""} ${p.dosageForm ?? ""} · ${p.therapeuticArea ?? ""}`}
        badges={p.isStrategic ? <Badge tone="brand">{t.products.strategic}</Badge> : null}
      />
      <Notice tone="phase">{t.products.movementPending}</Notice>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title={t.products.skus} />
          <CardBody>
            <dl>
              {data.skus.map((s) => (
                <Stat key={s.id} label={`${s.code} · ${s.packSize}`} value={exact(s.listPrice)} hint={t.common.iqdColumn} />
              ))}
            </dl>
          </CardBody>
        </Card>
        {showSales ? (
          <>
            <Card className="lg:col-span-2">
              <CardHeader title={t.dashboard.salesTrend} actions={<SourceBadge source="confirmed" t={t} />} />
              <CardBody>
                <BarSeries data={series} ariaLabel={t.dashboard.salesTrend} formatValue={m} formatLabel={(k) => formatMonth(k, locale)} />
                <p className="mt-2 text-xs text-muted">
                  {t.products.returns12m}: <span className="num font-semibold">{m(data.returns12m.value)}</span> ·{" "}
                  <span className="num">{data.returns12m.units}</span> {t.products.units}
                </p>
              </CardBody>
            </Card>
          </>
        ) : null}
      </div>

      <Card>
        <CardHeader title={t.products.batches} subtitle={t.products.officeStockHelp} actions={<SourceBadge source="confirmed" t={t} />} />
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{t.products.batch}</Th>
                <Th>{t.products.expiry}</Th>
                <Th numeric>{t.products.monthsToExpiry}</Th>
                <Th numeric>{t.products.received}</Th>
                <Th numeric>{t.products.delivered}</Th>
                <Th numeric>{t.products.officeStock}</Th>
                <Th numeric className="hidden sm:table-cell">{t.products.purchasers}</Th>
              </tr>
            </thead>
            <tbody>
              {data.batches.map((b) => {
                const days = daysBetween(today, b.expiryDate);
                const expired = days < 0;
                return (
                  <Tr key={b.id}>
                    <Td dir="ltr" className="whitespace-nowrap text-start font-medium text-ink">{b.batchNumber}</Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(b.expiryDate, locale)}
                      {expired ? (
                        <Badge tone="critical" className="ms-1.5">{t.products.expired}</Badge>
                      ) : days <= 270 ? (
                        <Badge tone={days <= 120 ? "bad" : "warn"} className="ms-1.5">{days} {t.common.daysShort}</Badge>
                      ) : null}
                    </Td>
                    <Td numeric>{expired ? "—" : (days / 30.4).toFixed(1)}</Td>
                    <Td numeric>{b.quantityReceived.toLocaleString("en-US")}</Td>
                    <Td numeric>{b.delivered.toLocaleString("en-US")}</Td>
                    <Td numeric>{(b.quantityReceived - b.delivered).toLocaleString("en-US")}</Td>
                    <Td numeric className="hidden sm:table-cell">{b.drugstoreCount}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      {showSales ? (
        <Card>
          <CardHeader title={t.products.purchasers} actions={<SourceBadge source="confirmed" t={t} />} />
          {data.purchasers.length === 0 ? (
            <EmptyState title={t.common.noData} />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>{t.drugstores.title}</Th>
                    <Th numeric>{t.products.units}</Th>
                    <Th numeric>{t.products.value}</Th>
                    <Th numeric className="hidden sm:table-cell">{t.drugstores.invoiceCount}</Th>
                    <Th>{t.products.lastPurchase}</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.purchasers.map((r) => (
                    <Tr key={r.drugstoreId}>
                      <Td>
                        <Link className="hover:underline" href={`/${locale}/drugstores/${r.drugstoreId}`}>
                          {loc(locale, r.name, r.nameAr)}
                        </Link>
                      </Td>
                      <Td numeric>{r.units.toLocaleString("en-US")}</Td>
                      <Td numeric>{m(r.value)}</Td>
                      <Td numeric className="hidden sm:table-cell">{r.orders}</Td>
                      <Td className="whitespace-nowrap">
                        {formatDate(r.lastPurchase, locale)}
                        {r.lastPurchase ? (
                          <span className="ms-1 text-[11px] text-muted">({daysBetween(r.lastPurchase, today)} {t.common.daysShort})</span>
                        ) : null}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      ) : null}
    </div>
  );
}

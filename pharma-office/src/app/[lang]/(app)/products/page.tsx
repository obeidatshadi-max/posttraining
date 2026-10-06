import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/form";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AccessDenied } from "@/components/data/access-denied";
import { SourceBadge } from "@/components/data/badges";
import { FilterBar, FilterField } from "@/components/data/filter-bar";
import { Notice, PageHeader } from "@/components/data/page-header";
import { can } from "@/lib/auth/permissions";
import { daysBetween } from "@/lib/domain/dates";
import { formatDate, loc, money } from "@/lib/format";
import { pageContext, readSearch } from "@/lib/page-context";
import { listProducts, productFiltersSchema } from "@/server/queries/products";

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t, user, today, allowed } = await pageContext(params, "products.view");
  if (!allowed) return <AccessDenied t={t} />;
  const f = productFiltersSchema.parse(await readSearch(searchParams));
  const { rows, areas } = await listProducts(user, f, today);
  const showSales = can(user, "financials.view");
  const base = `/${locale}/products`;
  const m = (v: number) => money(v, locale);

  return (
    <div className="space-y-4">
      <PageHeader title={t.products.title} subtitle={t.products.subtitle} badges={<SourceBadge source="confirmed" t={t} />} />
      <Notice tone="phase">{t.products.movementPending}</Notice>
      <Card>
        <FilterBar resetHref={base} applyLabel={t.common.apply} resetLabel={t.common.reset}>
          <FilterField label={t.common.search} htmlFor="q">
            <Input id="q" name="q" defaultValue={f.q} placeholder={t.products.searchPlaceholder} />
          </FilterField>
          <FilterField label={t.products.therapeuticArea} htmlFor="area">
            <Select id="area" name="area" defaultValue={f.area ?? ""}>
              <option value="">{t.common.all}</option>
              {areas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          </FilterField>
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState title={t.products.empty} />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{t.products.product}</Th>
                  <Th className="hidden md:table-cell">{t.products.therapeuticArea}</Th>
                  {showSales ? (
                    <>
                      <Th numeric>{t.products.sales12m}</Th>
                      <Th numeric className="hidden sm:table-cell">{t.products.sales90d}</Th>
                      <Th numeric className="hidden lg:table-cell">{t.products.drugstoresBuying}</Th>
                      <Th className="hidden md:table-cell">{t.products.lastSale}</Th>
                    </>
                  ) : null}
                  <Th>{t.products.nearestExpiry}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const daysLeft = r.nearestExpiry ? daysBetween(today, r.nearestExpiry) : null;
                  return (
                    <Tr key={r.id}>
                      <Td>
                        <Link href={`${base}/${r.id}`} className="font-medium text-ink hover:underline">
                          {loc(locale, r.name, r.nameAr)}
                        </Link>
                        {r.isStrategic ? <Badge tone="brand" className="ms-1.5">{t.products.strategic}</Badge> : null}
                        <span className="block text-[11px] text-muted">
                          {r.genericName} · <span dir="ltr">{r.code}</span>
                        </span>
                      </Td>
                      <Td className="hidden md:table-cell">{r.therapeuticArea}</Td>
                      {showSales ? (
                        <>
                          <Td numeric>{m(r.sales12)}</Td>
                          <Td numeric className="hidden sm:table-cell">{m(r.sales90)}</Td>
                          <Td numeric className="hidden lg:table-cell">{r.buyers}</Td>
                          <Td className="hidden whitespace-nowrap md:table-cell">{formatDate(r.lastSale, locale)}</Td>
                        </>
                      ) : null}
                      <Td className="whitespace-nowrap">
                        {formatDate(r.nearestExpiry, locale)}
                        {daysLeft !== null && daysLeft <= 270 ? (
                          <Badge tone={daysLeft <= 120 ? "bad" : "warn"} className="ms-1.5">
                            {daysLeft} {t.common.daysShort}
                          </Badge>
                        ) : null}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}

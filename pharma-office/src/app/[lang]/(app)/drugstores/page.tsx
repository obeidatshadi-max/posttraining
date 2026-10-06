import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { AccessDenied } from "@/components/data/access-denied";
import { SourceBadge } from "@/components/data/badges";
import { UtilisationBar } from "@/components/data/charts";
import { FilterBar, FilterField } from "@/components/data/filter-bar";
import { Notice, PageHeader } from "@/components/data/page-header";
import { formatPct } from "@/lib/domain/money";
import { formatDate, loc, money } from "@/lib/format";
import { pageContext, readSearch } from "@/lib/page-context";
import { drugstoreFiltersSchema, listDrugstores } from "@/server/queries/drugstores";
import { invoiceFilterOptions } from "@/server/queries/invoices";

export default async function DrugstoresPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t, user, today, allowed } = await pageContext(params, "drugstores.view");
  if (!allowed) return <AccessDenied t={t} />;
  const f = drugstoreFiltersSchema.parse(await readSearch(searchParams));
  const [rows, options] = await Promise.all([listDrugstores(user, f, today), invoiceFilterOptions(user)]);
  const base = `/${locale}/drugstores`;
  const m = (v: number) => money(v, locale);

  return (
    <div className="space-y-4">
      <PageHeader title={t.drugstores.title} subtitle={t.drugstores.subtitle} badges={<SourceBadge source="confirmed" t={t} />} />
      <Notice>{t.drugstores.scopeNote}</Notice>
      <Card>
        <FilterBar resetHref={base} applyLabel={t.common.apply} resetLabel={t.common.reset}>
          <FilterField label={t.common.search} htmlFor="q">
            <Input id="q" name="q" defaultValue={f.q} placeholder={t.drugstores.searchPlaceholder} />
          </FilterField>
          <FilterField label={t.drugstores.territory} htmlFor="territory">
            <Select id="territory" name="territory" defaultValue={f.territory ?? ""}>
              <option value="">{t.common.all}</option>
              {options.territories.map((o) => (
                <option key={o.id} value={o.id}>{loc(locale, o.nameEn, o.nameAr)}</option>
              ))}
            </Select>
          </FilterField>
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState title={t.drugstores.empty} />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{t.drugstores.title}</Th>
                  <Th className="hidden md:table-cell">{t.drugstores.territory}</Th>
                  <Th className="hidden lg:table-cell">{t.drugstores.rep}</Th>
                  <Th numeric>{t.drugstores.salesYtd}</Th>
                  <Th numeric>{t.drugstores.outstanding}</Th>
                  <Th numeric>{t.drugstores.overdue}</Th>
                  <Th numeric className="hidden sm:table-cell">{t.drugstores.creditLimit}</Th>
                  <Th numeric>{t.drugstores.utilisation}</Th>
                  <Th className="hidden md:table-cell">{t.drugstores.lastOrder}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const util = r.limit ? r.outstanding / r.limit : null;
                  return (
                    <Tr key={r.id}>
                      <Td>
                        <Link href={`${base}/${r.id}`} className="font-medium text-ink hover:underline">
                          {loc(locale, r.name, r.nameAr)}
                        </Link>
                        <span className="block text-[11px] text-muted">
                          <span dir="ltr">{r.code}</span> · {r.city}
                          {!r.active ? <Badge className="ms-1">{t.common.inactive}</Badge> : null}
                        </span>
                      </Td>
                      <Td className="hidden md:table-cell">{loc(locale, r.territoryEn, r.territoryAr)}</Td>
                      <Td className="hidden lg:table-cell">{loc(locale, r.repName, r.repNameAr) || "—"}</Td>
                      <Td numeric>{m(r.salesYtd)}</Td>
                      <Td numeric>{m(r.outstanding)}</Td>
                      <Td numeric className={r.overdue > 0 ? "font-semibold text-bad" : undefined}>{m(r.overdue)}</Td>
                      <Td numeric className="hidden sm:table-cell">{r.limit ? m(r.limit) : t.drugstores.noLimit}</Td>
                      <Td numeric className="w-32">
                        {util === null ? "—" : formatPct(util * 100)}
                        <UtilisationBar value={util} />
                      </Td>
                      <Td className="hidden whitespace-nowrap md:table-cell">{formatDate(r.lastOrder, locale)}</Td>
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

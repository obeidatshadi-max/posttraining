import Link from "next/link";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AccessDenied } from "@/components/data/access-denied";
import { PaymentStatusBadge, SourceBadge } from "@/components/data/badges";
import { FilterBar, FilterField } from "@/components/data/filter-bar";
import { PageHeader } from "@/components/data/page-header";
import { Pagination } from "@/components/data/pagination";
import { can } from "@/lib/auth/permissions";
import { PAYMENT_STATUSES, paymentStatus } from "@/lib/domain/payment-status";
import { exact, formatDate, loc } from "@/lib/format";
import { pageContext, readSearch } from "@/lib/page-context";
import { invoiceFilterOptions, invoiceFiltersSchema, listInvoices, PAGE_SIZE } from "@/server/queries/invoices";

export default async function SalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t, user, today, allowed } = await pageContext(params, "invoices.view");
  if (!allowed) return <AccessDenied t={t} />;
  const f = invoiceFiltersSchema.parse(await readSearch(searchParams));
  const [{ rows, total, totals }, options] = await Promise.all([listInvoices(user, f, today), invoiceFilterOptions(user)]);
  const base = `/${locale}/sales`;

  return (
    <div>
      <PageHeader
        title={t.invoices.title}
        subtitle={t.invoices.subtitle}
        badges={<SourceBadge source="confirmed" t={t} />}
        actions={
          can(user, "invoices.create") ? (
            <ButtonLink href={`${base}/new`}>
              <Plus className="size-4" aria-hidden />
              {t.invoices.newInvoice}
            </ButtonLink>
          ) : null
        }
      />
      <Card>
        <FilterBar resetHref={base} applyLabel={t.common.apply} resetLabel={t.common.reset}>
          <FilterField label={t.common.search} htmlFor="q">
            <Input id="q" name="q" defaultValue={f.q} placeholder={t.invoices.searchPlaceholder} />
          </FilterField>
          <FilterField label={t.invoices.territory} htmlFor="territory">
            <Select id="territory" name="territory" defaultValue={f.territory ?? ""}>
              <option value="">{t.common.all}</option>
              {options.territories.map((o) => (
                <option key={o.id} value={o.id}>{loc(locale, o.nameEn, o.nameAr)}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t.invoices.drugstore} htmlFor="drugstore">
            <Select id="drugstore" name="drugstore" defaultValue={f.drugstore ?? ""}>
              <option value="">{t.common.all}</option>
              {options.drugstores.map((o) => (
                <option key={o.id} value={o.id}>{loc(locale, o.name, o.nameAr)}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t.invoices.product} htmlFor="product">
            <Select id="product" name="product" defaultValue={f.product ?? ""}>
              <option value="">{t.common.all}</option>
              {options.products.map((o) => (
                <option key={o.id} value={o.id}>{loc(locale, o.name, o.nameAr)}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t.invoices.rep} htmlFor="rep">
            <Select id="rep" name="rep" defaultValue={f.rep ?? ""}>
              <option value="">{t.common.all}</option>
              {options.reps.map((o) => (
                <option key={o.id} value={o.id}>{loc(locale, o.fullName, o.fullNameAr)}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t.invoices.status} htmlFor="status">
            <Select id="status" name="status" defaultValue={f.status ?? ""}>
              <option value="">{t.common.all}</option>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{t.paymentStatus[s]}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t.common.from} htmlFor="from">
            <Input id="from" name="from" type="date" defaultValue={f.from} />
          </FilterField>
          <FilterField label={t.common.to} htmlFor="to">
            <Input id="to" name="to" type="date" defaultValue={f.to} />
          </FilterField>
          <FilterField label={t.invoices.expiryBefore} htmlFor="expiryBefore">
            <Input id="expiryBefore" name="expiryBefore" type="date" defaultValue={f.expiryBefore} />
          </FilterField>
          <FilterField label={t.common.minAmount} htmlFor="min">
            <Input id="min" name="min" type="number" min={0} step={1000} defaultValue={f.min} inputMode="numeric" />
          </FilterField>
          <FilterField label={t.common.maxAmount} htmlFor="max">
            <Input id="max" name="max" type="number" min={0} step={1000} defaultValue={f.max} inputMode="numeric" />
          </FilterField>
        </FilterBar>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 border-b border-line bg-canvas/50 px-4 py-2 text-xs">
          <dt className="sr-only">{t.invoices.totalsRow}</dt>
          <dd className="text-muted">{t.invoices.totalsRow}:</dd>
          <dd>
            {t.invoices.net}: <span className="num font-semibold">{exact(totals.net)}</span>
          </dd>
          <dd>
            {t.invoices.paid}: <span className="num font-semibold">{exact(totals.paid)}</span>
          </dd>
          <dd>
            {t.invoices.outstanding}: <span className="num font-semibold">{exact(totals.net - totals.paid)}</span>
          </dd>
        </dl>
        {rows.length === 0 ? (
          <EmptyState title={t.invoices.empty} />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{t.invoices.number}</Th>
                  <Th>{t.invoices.date}</Th>
                  <Th>{t.invoices.drugstore}</Th>
                  <Th className="hidden md:table-cell">{t.invoices.territory}</Th>
                  <Th className="hidden lg:table-cell">{t.invoices.rep}</Th>
                  <Th numeric>{t.invoices.net} ({t.common.iqdColumn})</Th>
                  <Th numeric className="hidden sm:table-cell">{t.invoices.paid}</Th>
                  <Th numeric>{t.invoices.outstanding}</Th>
                  <Th>{t.invoices.dueDate}</Th>
                  <Th>{t.invoices.status}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const status = paymentStatus(r, today);
                  return (
                    <Tr key={r.id}>
                      <Td>
                        <Link href={`${base}/${r.id}`} className="font-medium text-brand hover:underline" dir="ltr">
                          {r.invoiceNumber}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap">{formatDate(r.invoiceDate, locale)}</Td>
                      <Td>
                        <Link href={`/${locale}/drugstores/${r.drugstoreId}`} className="hover:underline">
                          {loc(locale, r.drugstoreName, r.drugstoreNameAr)}
                        </Link>
                      </Td>
                      <Td className="hidden md:table-cell">{loc(locale, r.territoryEn, r.territoryAr)}</Td>
                      <Td className="hidden lg:table-cell">{loc(locale, r.repName, r.repNameAr) || "—"}</Td>
                      <Td numeric>{exact(r.netAmount)}</Td>
                      <Td numeric className="hidden sm:table-cell">{exact(r.paidAmount)}</Td>
                      <Td numeric className={status === "overdue" ? "font-semibold text-bad" : undefined}>
                        {exact(r.netAmount - r.paidAmount)}
                      </Td>
                      <Td className="whitespace-nowrap">{formatDate(r.dueDate, locale)}</Td>
                      <Td>
                        <PaymentStatusBadge status={status} t={t} />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
        <Pagination basePath={base} params={{ ...f, page: undefined }} page={f.page} pageSize={PAGE_SIZE} total={total} t={t} />
      </Card>
    </div>
  );
}

import Link from "next/link";
import { CheckCircle2, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AccessDenied } from "@/components/data/access-denied";
import { SourceBadge } from "@/components/data/badges";
import { FilterBar, FilterField } from "@/components/data/filter-bar";
import { KpiCard } from "@/components/data/kpi-card";
import { Notice, PageHeader } from "@/components/data/page-header";
import { Pagination } from "@/components/data/pagination";
import { can } from "@/lib/auth/permissions";
import { startOfMonth } from "@/lib/domain/dates";
import { exact, formatDate, loc, money } from "@/lib/format";
import { pageContext, readSearch } from "@/lib/page-context";
import { collectionsTotal, receivablesSummary } from "@/server/queries/dashboard";
import { invoiceFilterOptions } from "@/server/queries/invoices";
import { getRecordedPayment, listPayments, PAYMENTS_PAGE_SIZE, paymentFiltersSchema } from "@/server/queries/payments";

const METHODS = ["cash", "bank_transfer", "cheque", "other"] as const;

export default async function CollectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t, user, today, allowed } = await pageContext(params, "payments.view");
  if (!allowed) return <AccessDenied t={t} />;
  const f = paymentFiltersSchema.parse(await readSearch(searchParams));
  const [list, recv, collected, options, recorded] = await Promise.all([
    listPayments(user, f),
    receivablesSummary(user, today),
    collectionsTotal(user, startOfMonth(today), today),
    invoiceFilterOptions(user),
    f.recorded ? getRecordedPayment(user, f.recorded) : Promise.resolve(null),
  ]);
  const base = `/${locale}/collections`;
  const m = (v: number) => money(v, locale);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.payments.title}
        subtitle={t.payments.subtitle}
        badges={<SourceBadge source="confirmed" t={t} />}
        actions={
          can(user, "payments.record") ? (
            <ButtonLink href={`${base}/new`}>
              <Plus className="size-4" aria-hidden />
              {t.payments.recordPayment}
            </ButtonLink>
          ) : null
        }
      />
      {recorded ? (
        <p role="status" className="flex items-center gap-2 rounded-md bg-good-soft px-3 py-2 text-sm text-good">
          <CheckCircle2 className="size-4" aria-hidden />
          <span dir="ltr">{recorded.paymentNumber}</span> · {loc(locale, recorded.drugstoreName, recorded.drugstoreNameAr)} ·{" "}
          <span className="num">{exact(recorded.amount)}</span>
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t.payments.collectedMtd} value={m(collected)} source={<SourceBadge source="confirmed" t={t} />} />
        <KpiCard label={t.payments.receivables} value={m(recv.total)} source={<SourceBadge source="confirmed" t={t} />} />
        <KpiCard label={t.payments.notDue} value={m(recv.notDue)} source={<SourceBadge source="confirmed" t={t} />} />
        <KpiCard
          label={t.payments.overdue}
          value={<span className={recv.overdue ? "text-bad" : undefined}>{m(recv.overdue)}</span>}
          source={<SourceBadge source="confirmed" t={t} />}
          href={`/${locale}/sales?status=overdue`}
        />
      </div>
      <Notice tone="phase">
        <span className="font-semibold">{t.payments.phase2Title}:</span> {t.payments.phase2Body}
      </Notice>
      <Card>
        <FilterBar resetHref={base} applyLabel={t.common.apply} resetLabel={t.common.reset}>
          <FilterField label={t.payments.drugstore} htmlFor="drugstore">
            <Select id="drugstore" name="drugstore" defaultValue={f.drugstore ?? ""}>
              <option value="">{t.common.all}</option>
              {options.drugstores.map((o) => (
                <option key={o.id} value={o.id}>{loc(locale, o.name, o.nameAr)}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t.payments.method} htmlFor="method">
            <Select id="method" name="method" defaultValue={f.method ?? ""}>
              <option value="">{t.common.all}</option>
              {METHODS.map((mm) => (
                <option key={mm} value={mm}>{t.paymentMethod[mm]}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t.common.from} htmlFor="from">
            <Input id="from" name="from" type="date" defaultValue={f.from} />
          </FilterField>
          <FilterField label={t.common.to} htmlFor="to">
            <Input id="to" name="to" type="date" defaultValue={f.to} />
          </FilterField>
        </FilterBar>
        <p className="border-b border-line bg-canvas/50 px-4 py-2 text-xs">
          {t.common.total}: <span className="num font-semibold">{exact(list.amount)}</span>
        </p>
        {list.rows.length === 0 ? (
          <EmptyState title={t.payments.empty} />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{t.payments.number}</Th>
                  <Th>{t.payments.date}</Th>
                  <Th>{t.payments.drugstore}</Th>
                  <Th>{t.payments.method}</Th>
                  <Th className="hidden md:table-cell">{t.payments.reference}</Th>
                  <Th numeric>{t.payments.amount} ({t.common.iqdColumn})</Th>
                  <Th numeric className="hidden sm:table-cell">{t.payments.allocated}</Th>
                  <Th numeric className="hidden sm:table-cell">{t.payments.unallocated}</Th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((r) => (
                  <Tr key={r.id}>
                    <Td dir="ltr" className="whitespace-nowrap text-start font-medium text-ink">{r.paymentNumber}</Td>
                    <Td className="whitespace-nowrap">{formatDate(r.paymentDate, locale)}</Td>
                    <Td>
                      <Link className="hover:underline" href={`/${locale}/drugstores/${r.drugstoreId}`}>
                        {loc(locale, r.drugstoreName, r.drugstoreNameAr)}
                      </Link>
                    </Td>
                    <Td>{t.paymentMethod[r.method]}</Td>
                    <Td className="hidden md:table-cell" dir="ltr">{r.reference ?? "—"}</Td>
                    <Td numeric>{exact(r.amount)}</Td>
                    <Td numeric className="hidden sm:table-cell">{exact(r.allocated)}</Td>
                    <Td numeric className="hidden sm:table-cell">{r.amount - r.allocated > 0 ? exact(r.amount - r.allocated) : "—"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
        <Pagination
          basePath={base}
          params={{ ...f, recorded: undefined, page: undefined }}
          page={f.page}
          pageSize={PAYMENTS_PAGE_SIZE}
          total={list.total}
          t={t}
        />
      </Card>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { AccessDenied } from "@/components/data/access-denied";
import { PaymentStatusBadge, SourceBadge } from "@/components/data/badges";
import { PageHeader, Stat } from "@/components/data/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { can } from "@/lib/auth/permissions";
import { computeLine } from "@/lib/domain/pricing";
import { daysOverdue, paymentStatus } from "@/lib/domain/payment-status";
import { formatPct } from "@/lib/domain/money";
import { exact, formatDate, loc } from "@/lib/format";
import { interpolate } from "@/lib/i18n/config";
import { pageContext } from "@/lib/page-context";
import { getInvoice } from "@/server/queries/invoices";

export default async function InvoicePage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { locale, t, user, today, allowed } = await pageContext(params, "invoices.view");
  if (!allowed) return <AccessDenied t={t} />;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const inv = await getInvoice(user, id);
  if (!inv) {
    return <EmptyState title={t.invoices.notFound} />;
  }
  const status = paymentStatus(inv, today);
  const lines = inv.lines.map((l) => ({
    ...l,
    calc: computeLine({
      quantity: l.quantity,
      bonusQuantity: l.bonusQuantity,
      unitPrice: l.unitPrice,
      listPrice: l.listPrice,
      discountPct: l.discountPct,
    }),
  }));
  const delivered = lines.reduce((a, l) => a + l.calc.deliveredUnits, 0);
  const investment = lines.reduce((a, l) => a + l.calc.commercialInvestment, 0);
  const overdueDays = status === "overdue" ? daysOverdue(inv.dueDate, today) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={interpolate(t.invoices.detailTitle, { number: inv.invoiceNumber })}
        subtitle={loc(locale, inv.drugstoreName, inv.drugstoreNameAr)}
        badges={
          <>
            <PaymentStatusBadge status={status} t={t} />
            <SourceBadge source="confirmed" t={t} />
          </>
        }
        actions={
          <>
            <ButtonLink variant="secondary" href={`/${locale}/drugstores/${inv.drugstoreId}`}>
              {t.drugstores.title}
            </ButtonLink>
            {can(user, "payments.record") && inv.netAmount > inv.paidAmount ? (
              <ButtonLink href={`/${locale}/collections/new?drugstore=${inv.drugstoreId}`}>{t.drugstores.recordPayment}</ButtonLink>
            ) : null}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title={t.invoices.number} />
          <CardBody>
            <dl>
              <Stat label={t.invoices.date} value={formatDate(inv.invoiceDate, locale)} />
              <Stat label={t.invoices.paymentTerm} value={interpolate(t.invoices.termDays, { days: inv.paymentTermDays })} />
              <Stat
                label={t.invoices.dueDate}
                value={formatDate(inv.dueDate, locale)}
                hint={overdueDays ? `(+${overdueDays} ${t.common.daysShort})` : undefined}
              />
              <Stat label={t.invoices.rep} value={loc(locale, inv.repName, inv.repNameAr) || "—"} />
              <Stat label={t.invoices.createdBy} value={loc(locale, inv.createdByName, inv.createdByNameAr) || "—"} />
            </dl>
            {inv.isDisputed ? (
              <p className="mt-3 rounded-md bg-estimated-soft px-3 py-2 text-xs text-ink-2">
                <span className="font-semibold">{t.invoices.disputed}:</span> {inv.disputeNote ?? "—"}
              </p>
            ) : null}
            {inv.notes ? <p className="mt-3 text-xs text-ink-2">{t.invoices.notes}: {inv.notes}</p> : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.invoices.lineNet} />
          <CardBody>
            <dl>
              <Stat label={t.invoices.gross} value={exact(inv.grossAmount)} />
              <Stat label={t.invoices.discount} value={`− ${exact(inv.discountAmount)}`} />
              <Stat label={t.invoices.net} value={exact(inv.netAmount)} />
              <Stat label={t.invoices.paid} value={exact(inv.paidAmount)} />
              <Stat label={t.invoices.outstanding} value={<span className={status === "overdue" ? "text-bad" : undefined}>{exact(inv.netAmount - inv.paidAmount)}</span>} />
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.invoices.investment} subtitle={t.invoices.investmentHelp} />
          <CardBody>
            <dl>
              <Stat label={t.invoices.form.deliveredUnits} value={delivered.toLocaleString("en-US")} />
              <Stat label={t.invoices.investment} value={exact(investment)} />
            </dl>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={t.invoices.lines} subtitle={t.invoices.effectivePriceHelp} />
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{t.invoices.product}</Th>
                <Th>{t.invoices.batch}</Th>
                <Th>{t.invoices.expiry}</Th>
                <Th numeric>{t.invoices.qty}</Th>
                <Th numeric>{t.invoices.bonus}</Th>
                <Th numeric>{t.invoices.listPrice}</Th>
                <Th numeric>{t.invoices.invoicePrice}</Th>
                <Th numeric>{t.invoices.discountPct}</Th>
                <Th numeric>{t.invoices.lineNet}</Th>
                <Th numeric>{t.invoices.effectivePrice}</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <Tr key={l.id}>
                  <Td>
                    <span className="font-medium text-ink">{loc(locale, l.productName, l.productNameAr)}</span>
                    <span className="block text-[11px] text-muted" dir="ltr">
                      {l.skuCode} · {l.packSize}
                    </span>
                  </Td>
                  <Td dir="ltr" className="whitespace-nowrap text-start">{l.batchNumber ?? "—"}</Td>
                  <Td className="whitespace-nowrap">{formatDate(l.expiryDate, locale)}</Td>
                  <Td numeric>{l.quantity.toLocaleString("en-US")}</Td>
                  <Td numeric>{l.bonusQuantity ? l.bonusQuantity.toLocaleString("en-US") : "—"}</Td>
                  <Td numeric>{exact(l.listPrice)}</Td>
                  <Td numeric>{exact(l.unitPrice)}</Td>
                  <Td numeric>{l.discountPct ? formatPct(l.discountPct, 1) : "—"}</Td>
                  <Td numeric>{exact(l.netAmount)}</Td>
                  <Td numeric className="font-semibold text-ink">
                    {exact(l.calc.effectiveUnitPrice)}
                    {l.calc.effectiveDiscountVsListPct > 0 ? (
                      <span className="block text-[11px] font-normal text-muted">−{formatPct(l.calc.effectiveDiscountVsListPct, 1)}</span>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      <Card>
        <CardHeader title={t.invoices.allocations} actions={<SourceBadge source="confirmed" t={t} />} />
        {inv.allocations.length === 0 ? (
          <EmptyState title={t.invoices.noAllocations} />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{t.payments.number}</Th>
                  <Th>{t.payments.date}</Th>
                  <Th>{t.payments.method}</Th>
                  <Th numeric>{t.payments.amount}</Th>
                </tr>
              </thead>
              <tbody>
                {inv.allocations.map((a) => (
                  <Tr key={`${a.paymentId}`}>
                    <Td dir="ltr" className="text-start">
                      <Link className="text-brand hover:underline" href={`/${locale}/collections?drugstore=${inv.drugstoreId}`}>
                        {a.paymentNumber}
                      </Link>
                    </Td>
                    <Td>{formatDate(a.paymentDate, locale)}</Td>
                    <Td>{t.paymentMethod[a.method]}</Td>
                    <Td numeric>{exact(a.amount)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AccessDenied } from "@/components/data/access-denied";
import { ConfidenceBadge, PaymentStatusBadge, SourceBadge } from "@/components/data/badges";
import { UtilisationBar } from "@/components/data/charts";
import { Notice, PageHeader, Stat } from "@/components/data/page-header";
import { can } from "@/lib/auth/permissions";
import { formatPct } from "@/lib/domain/money";
import { paymentStatus } from "@/lib/domain/payment-status";
import { exact, formatDate, loc, money } from "@/lib/format";
import { interpolate } from "@/lib/i18n/config";
import { pageContext } from "@/lib/page-context";
import { getDrugstore } from "@/server/queries/drugstores";

export default async function DrugstorePage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { locale, t, user, today, allowed } = await pageContext(params, "drugstores.view");
  if (!allowed) return <AccessDenied t={t} />;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const d = await getDrugstore(user, id, today);
  if (!d) return <EmptyState title={t.drugstores.notFound} />;
  const m = (v: number) => money(v, locale);
  const fin = d.financial;

  return (
    <div className="space-y-5">
      <PageHeader
        title={loc(locale, d.name, d.nameAr)}
        subtitle={`${d.code} · ${d.city} · ${loc(locale, d.territoryEn, d.territoryAr)}`}
        badges={<Badge tone={d.active ? "good" : "neutral"}>{d.active ? t.common.active : t.common.inactive}</Badge>}
        actions={
          <>
            {can(user, "invoices.create") ? (
              <ButtonLink variant="secondary" href={`/${locale}/sales/new`}>{t.drugstores.newInvoice}</ButtonLink>
            ) : null}
            {can(user, "payments.record") ? (
              <ButtonLink href={`/${locale}/collections/new?drugstore=${d.id}`}>{t.drugstores.recordPayment}</ButtonLink>
            ) : null}
          </>
        }
      />
      <Notice>{t.drugstores.scopeNote}</Notice>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title={t.drugstores.identification} />
          <CardBody>
            <dl>
              <Stat label={t.drugstores.contact} value={d.contactPerson ?? "—"} />
              <Stat label={t.drugstores.phone} value={<span dir="ltr">{d.phone ?? "—"}</span>} />
              <Stat label={t.drugstores.city} value={`${d.city}${d.address ? ` · ${d.address}` : ""}`} />
              <Stat label={t.drugstores.rep} value={loc(locale, d.repName, d.repNameAr) || "—"} />
              <Stat label={t.drugstores.manager} value={loc(locale, d.managerName, d.managerNameAr) || "—"} />
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.drugstores.commercial} actions={<SourceBadge source="confirmed" t={t} />} />
          <CardBody>
            <dl>
              <Stat label={t.drugstores.totalPurchases} value={m(d.commercial.totalPurchases)} />
              <Stat label={t.drugstores.ytdPurchases} value={m(d.commercial.ytd)} />
              <Stat label={t.drugstores.lastOrder} value={formatDate(d.commercial.lastOrder, locale)} />
              <Stat label={t.drugstores.avgOrder} value={m(d.commercial.avgOrder)} />
              <Stat label={t.drugstores.invoiceCount} value={d.commercial.invoiceCount} />
              <Stat label={t.drugstores.activeProducts} value={d.commercial.activeProducts} />
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.drugstores.financial} actions={<SourceBadge source="confirmed" t={t} />} />
          <CardBody>
            <dl>
              <Stat label={t.drugstores.outstanding} value={m(fin.outstanding)} />
              <Stat label={t.drugstores.notDueBalance} value={m(fin.notDue)} />
              <Stat label={t.drugstores.overdueBalance} value={<span className={fin.overdue ? "text-bad" : undefined}>{m(fin.overdue)}</span>} />
              {fin.disputed ? <Stat label={t.paymentStatus.disputed} value={m(fin.disputed)} /> : null}
              <Stat
                label={t.drugstores.longestOverdue}
                value={fin.longestOverdueDays ? `${fin.longestOverdueDays} ${t.common.days}` : "—"}
              />
              <Stat label={t.drugstores.agreedTerms} value={interpolate(t.invoices.termDays, { days: d.paymentTermDays })} />
              <Stat label={t.drugstores.creditLimit} value={fin.limit !== null ? m(fin.limit) : t.drugstores.noLimit} />
              <Stat
                label={t.drugstores.utilisation}
                value={fin.utilisation !== null ? formatPct(fin.utilisation * 100) : "—"}
              />
              <Stat label={t.drugstores.availableCredit} value={fin.available !== null ? m(fin.available) : "—"} />
            </dl>
            <UtilisationBar value={fin.utilisation} />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title={t.drugstores.returnsTitle} actions={<SourceBadge source="confirmed" t={t} />} />
          <CardBody>
            <dl>
              <Stat label={t.drugstores.returnsCount} value={d.returns12m.count} />
              <Stat label={t.drugstores.returnsValue} value={m(d.returns12m.value)} />
              <Stat label={t.drugstores.returnsRate} value={d.returns12m.rate !== null ? formatPct(d.returns12m.rate * 100, 1) : "—"} />
              <Stat label={t.returnReason.expiry + " / " + t.returnReason.near_expiry} value={m(d.returns12m.expiryValue)} />
              <Stat label={t.returnReason.damaged} value={m(d.returns12m.damagedValue)} />
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.drugstores.relationshipTitle} actions={<SourceBadge source="estimated" t={t} />} />
          <CardBody>
            <Notice tone="phase">{t.drugstores.relationshipPending}</Notice>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.drugstores.expiryTitle} actions={<SourceBadge source="estimated" t={t} />} />
          <CardBody>
            <Notice tone="phase">{t.drugstores.expiryPending}</Notice>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title={t.drugstores.recentInvoices}
            actions={
              <Link className="text-xs font-medium text-brand hover:underline" href={`/${locale}/sales?drugstore=${d.id}`}>
                {t.common.viewAll}
              </Link>
            }
          />
          {d.recentInvoices.length === 0 ? (
            <EmptyState title={t.invoices.empty} />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>{t.invoices.number}</Th>
                    <Th>{t.invoices.date}</Th>
                    <Th numeric>{t.invoices.net}</Th>
                    <Th numeric>{t.invoices.outstanding}</Th>
                    <Th>{t.invoices.status}</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentInvoices.map((i) => (
                    <Tr key={i.id}>
                      <Td dir="ltr" className="text-start">
                        <Link className="text-brand hover:underline" href={`/${locale}/sales/${i.id}`}>{i.invoiceNumber}</Link>
                      </Td>
                      <Td className="whitespace-nowrap">{formatDate(i.invoiceDate, locale)}</Td>
                      <Td numeric>{exact(i.netAmount)}</Td>
                      <Td numeric>{exact(i.netAmount - i.paidAmount)}</Td>
                      <Td><PaymentStatusBadge status={paymentStatus(i, today)} t={t} /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
        <Card>
          <CardHeader
            title={t.drugstores.recentPayments}
            actions={
              <Link className="text-xs font-medium text-brand hover:underline" href={`/${locale}/collections?drugstore=${d.id}`}>
                {t.common.viewAll}
              </Link>
            }
          />
          {d.recentPayments.length === 0 ? (
            <EmptyState title={t.payments.empty} />
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
                  {d.recentPayments.map((p) => (
                    <Tr key={p.id}>
                      <Td dir="ltr" className="text-start">{p.paymentNumber}</Td>
                      <Td className="whitespace-nowrap">{formatDate(p.paymentDate, locale)}</Td>
                      <Td>{t.paymentMethod[p.method]}</Td>
                      <Td numeric>{exact(p.amount)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title={t.drugstores.signalsTitle} actions={<SourceBadge source="reported" t={t} />} />
        {d.signals.length === 0 ? (
          <EmptyState title={t.signals.empty} />
        ) : (
          <ul className="divide-y divide-line">
            {d.signals.map((s) => (
              <li key={s.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="reported">{t.signalCategory[s.category]}</Badge>
                  <ConfidenceBadge level={s.confidence} t={t} />
                  <span className="text-xs text-muted">
                    {formatDate(s.signalDate, locale)} · {loc(locale, s.reporterName, s.reporterNameAr)}
                    {s.productName ? ` · ${loc(locale, s.productName, s.productNameAr)}` : ""}
                  </span>
                </div>
                <p className="mt-1 text-ink-2">{s.observation}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

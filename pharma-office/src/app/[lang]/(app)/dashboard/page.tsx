import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AccessDenied } from "@/components/data/access-denied";
import { ConfidenceBadge, SeverityBadge, SourceBadge, SourceLegend } from "@/components/data/badges";
import { BarSeries, StackedBar, UtilisationBar } from "@/components/data/charts";
import { Delta, KpiCard } from "@/components/data/kpi-card";
import { Notice, PageHeader } from "@/components/data/page-header";
import { pageContext } from "@/lib/page-context";
import { addDays, addMonths, endOfMonth, shiftRangeMonths, startOfMonth } from "@/lib/domain/dates";
import { formatPct, pctChange } from "@/lib/domain/money";
import { formatDate, formatMonth, loc, money } from "@/lib/format";
import { interpolate, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  amountFallingDue,
  attentionItems,
  collectionsTotal,
  drugstoresByExposure,
  hasInvoicesOnOrBefore,
  monthlySales,
  monthlyTarget,
  openSignalsCount,
  receivablesSummary,
  salesTotal,
  type AttentionItem,
} from "@/server/queries/dashboard";

export default async function DashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { locale, t, user, today, allowed } = await pageContext(params, "dashboard.view");
  if (!allowed) return <AccessDenied t={t} />;

  const monthStart = startOfMonth(today);
  const mtd = { from: monthStart, to: today };
  const prev = shiftRangeMonths(mtd, -1);
  const lastYear = shiftRangeMonths(mtd, -12);
  const seriesFrom = startOfMonth(addMonths(monthStart, -12));

  const [salesMtd, salesPrev, salesLy, hasLy, target, collected, dueMonth, dueToDate, recv, signals, monthly, attention, top] =
    await Promise.all([
      salesTotal(user, mtd.from, mtd.to),
      salesTotal(user, prev.from, prev.to),
      salesTotal(user, lastYear.from, lastYear.to),
      hasInvoicesOnOrBefore(user, lastYear.to),
      monthlyTarget(user, monthStart),
      collectionsTotal(user, mtd.from, mtd.to),
      amountFallingDue(user, monthStart, endOfMonth(today)),
      amountFallingDue(user, monthStart, today),
      receivablesSummary(user, today),
      openSignalsCount(user, addDays(today, -30)),
      monthlySales(user, seriesFrom, today),
      attentionItems(user, today),
      drugstoresByExposure(user, today),
    ]);

  const byMonth = new Map(monthly.map((m) => [m.month, m.value]));
  const series = Array.from({ length: 13 }, (_, i) => {
    const key = startOfMonth(addMonths(seriesFrom, i));
    return { key, value: byMonth.get(key) ?? 0 };
  });
  const m = (v: number) => money(v, locale);
  const achievement = dueToDate > 0 ? (collected / dueToDate) * 100 : null;
  const overduePct = recv.total > 0 ? (recv.overdue / recv.total) * 100 : 0;
  const base = `/${locale}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.dashboard.title}
        subtitle={`${t.dashboard.subtitle} ${interpolate(t.common.asOf, { date: formatDate(today, locale) })}`}
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" aria-label="KPIs">
        <KpiCard
          label={t.dashboard.salesThisMonth}
          value={m(salesMtd)}
          source={<SourceBadge source="confirmed" t={t} />}
          href={`${base}/sales?from=${mtd.from}&to=${mtd.to}`}
          lines={[
            <Delta key="p" value={pctChange(salesMtd, salesPrev)} suffix={t.dashboard.vsPrevPeriod} />,
            target ? (
              <span key="t">
                <span className="num font-semibold">{formatPct((salesMtd / target) * 100)}</span> {t.dashboard.vsTarget} ({m(target)}){" "}
                <span className="text-muted">
                  · {interpolate(t.dashboard.monthProgress, { day: Number(today.slice(8, 10)), days: Number(endOfMonth(today).slice(8, 10)) })}
                </span>
              </span>
            ) : (
              <span key="t" className="text-muted">{t.dashboard.noTarget}</span>
            ),
            hasLy ? (
              <Delta key="y" value={pctChange(salesMtd, salesLy)} suffix={t.dashboard.vsLastYear} />
            ) : (
              <span key="y" className="text-muted">{t.dashboard.noYoY}</span>
            ),
          ]}
        />
        <KpiCard
          label={t.dashboard.collectionsThisMonth}
          value={m(collected)}
          source={<SourceBadge source="confirmed" t={t} />}
          href={`${base}/collections?from=${mtd.from}&to=${mtd.to}`}
          lines={[
            <span key="d">
              {t.dashboard.dueThisMonth}: <span className="num font-semibold">{m(dueMonth)}</span>
            </span>,
            <span key="a" title={t.dashboard.collectionAchievementHelp}>
              {t.dashboard.collectionAchievement}: <span className="num font-semibold">{formatPct(achievement)}</span>{" "}
              <span className="text-muted">
                ({t.dashboard.dueToDate} {m(dueToDate)})
              </span>
            </span>,
          ]}
        />
        <KpiCard
          label={t.dashboard.totalExposure}
          value={m(recv.total)}
          source={<SourceBadge source="confirmed" t={t} />}
          href={`${base}/drugstores`}
          lines={[
            <span key="n">
              {t.dashboard.notDue}: <span className="num font-semibold">{m(recv.notDue)}</span>
            </span>,
            <span key="o">
              {t.dashboard.overdue}: <span className="num font-semibold text-bad">{m(recv.overdue)}</span>
            </span>,
          ]}
        />
        <KpiCard
          label={t.dashboard.overdueAmount}
          value={<span className={recv.overdue > 0 ? "text-bad" : undefined}>{m(recv.overdue)}</span>}
          source={<SourceBadge source="confirmed" t={t} />}
          href={`${base}/sales?status=overdue`}
          lines={[
            <span key="p">
              <span className="num font-semibold">{formatPct(overduePct)}</span> {t.dashboard.ofReceivables}
            </span>,
            <span key="c">{interpolate(t.dashboard.drugstoresOverdue, { count: recv.overdueDrugstores })}</span>,
          ]}
        />
        <KpiCard
          label={t.dashboard.expiryExposure}
          value={t.common.notSet}
          muted
          source={<SourceBadge source="estimated" t={t} />}
          lines={[<span key="x" className="text-muted">{t.dashboard.expiryExposurePending}</span>]}
        />
        <KpiCard
          label={t.dashboard.marketAlerts}
          value={signals}
          source={<SourceBadge source="reported" t={t} />}
          href={`${base}/market-signals`}
          lines={[<span key="h" className="text-muted">{t.dashboard.marketAlertsHelp}</span>]}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader
            title={t.dashboard.attentionTitle}
            subtitle={t.dashboard.attentionSubtitle}
            actions={<SourceBadge source="confirmed" t={t} />}
          />
          <CardBody className="space-y-3">
            <Notice tone="phase">{t.dashboard.attentionPhaseNote}</Notice>
            {attention.length === 0 ? (
              <EmptyState title={t.dashboard.attentionEmpty} />
            ) : (
              <ol className="divide-y divide-line">
                {attention.slice(0, 8).map((item) => (
                  <AttentionRow key={item.key} item={item} t={t} locale={locale} today={today} />
                ))}
              </ol>
            )}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title={t.dashboard.salesTrend} subtitle={t.dashboard.salesTrendNote} actions={<SourceBadge source="confirmed" t={t} />} />
            <CardBody>
              <BarSeries
                data={series}
                ariaLabel={t.dashboard.salesTrend}
                formatValue={(v) => m(v)}
                formatLabel={(k) => formatMonth(k, locale)}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t.dashboard.receivablesSplit} actions={<SourceBadge source="confirmed" t={t} />} />
            <CardBody className="space-y-2">
              <StackedBar
                ariaLabel={t.dashboard.receivablesSplit}
                parts={[
                  { value: recv.notDue, className: "bg-brand", label: t.dashboard.notDue },
                  { value: recv.overdue, className: "bg-bad", label: t.dashboard.overdue },
                  { value: recv.disputed, className: "bg-estimated", label: t.paymentStatus.disputed },
                ]}
              />
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="flex items-center gap-1 text-muted"><span className="size-2 rounded-full bg-brand" />{t.dashboard.notDue}</dt>
                  <dd className="num font-semibold">{m(recv.notDue)}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-muted"><span className="size-2 rounded-full bg-bad" />{t.dashboard.overdue}</dt>
                  <dd className="num font-semibold">{m(recv.overdue)}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-muted"><span className="size-2 rounded-full bg-estimated" />{t.paymentStatus.disputed}</dt>
                  <dd className="num font-semibold">{m(recv.disputed)}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
          <SourceLegend t={t} />
        </div>
      </div>

      <Card>
        <CardHeader title={t.dashboard.topDrugstores} subtitle={t.dashboard.topDrugstoresNote} actions={<SourceBadge source="confirmed" t={t} />} />
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{t.drugstores.title}</Th>
                <Th numeric>{t.drugstores.outstanding}</Th>
                <Th numeric>{t.drugstores.overdue}</Th>
                <Th numeric>{t.products.sales90d}</Th>
                <Th numeric>{t.drugstores.utilisation}</Th>
              </tr>
            </thead>
            <tbody>
              {top.map((d) => {
                const util = d.limit ? d.exposure / d.limit : null;
                return (
                  <Tr key={d.id}>
                    <Td>
                      <Link className="font-medium text-ink hover:underline" href={`${base}/drugstores/${d.id}`}>
                        {loc(locale, d.name, d.nameAr)}
                      </Link>
                    </Td>
                    <Td numeric>{m(d.exposure)}</Td>
                    <Td numeric className={d.overdue > 0 ? "text-bad" : undefined}>{m(d.overdue)}</Td>
                    <Td numeric>{m(d.sales90)}</Td>
                    <Td numeric className="w-36">
                      {util === null ? t.drugstores.noLimit : formatPct(util * 100)}
                      <UtilisationBar value={util} />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </div>
  );
}

function AttentionRow({ item, t, locale, today }: { item: AttentionItem; t: Dictionary; locale: Locale; today: string }) {
  const name = loc(locale, item.drugstoreName, item.drugstoreNameAr);
  const amount = money(item.amount, locale);
  const f = item.facts;
  const it = t.dashboard.item;
  let title: string;
  let action: string;
  const evidence: string[] = [];
  switch (item.kind) {
    case "overdue":
      title = interpolate(it.overdueTitle, { name, amount });
      action = it.overdueAction;
      evidence.push(interpolate(it.evInvoices, { count: f.invoiceCount ?? 0 }));
      evidence.push(interpolate(it.evOldest, { days: f.maxDaysOverdue ?? 0 }));
      evidence.push(interpolate(it.evAgreedTerms, { days: f.termDays ?? 0 }));
      break;
    case "due_soon":
      title = interpolate(it.dueSoonTitle, { name, amount, days: 7 });
      action = it.dueSoonAction;
      evidence.push(interpolate(it.evInvoices, { count: f.invoiceCount ?? 0 }));
      evidence.push(interpolate(it.evNextDue, { date: formatDate(f.nextDueDate ?? today, locale) }));
      break;
    case "credit":
      title = interpolate(it.creditTitle, { name, pct: formatPct((f.utilisation ?? 0) * 100) });
      action = it.creditAction;
      evidence.push(interpolate(it.evExposure, { amount: money(f.exposure ?? 0, locale), limit: money(f.limit ?? 0, locale) }));
      break;
    case "disputed":
      title = interpolate(it.disputedTitle, { name, count: f.invoiceCount ?? 0, amount });
      action = it.disputedAction;
      evidence.push(interpolate(it.evInvoices, { count: f.invoiceCount ?? 0 }));
      evidence.push(it.evDisputedExcluded);
      break;
  }
  const href =
    item.kind === "credit"
      ? `/${locale}/drugstores/${item.drugstoreId}`
      : `/${locale}/sales?drugstore=${item.drugstoreId}&status=${item.kind === "due_soon" ? "due_soon" : item.kind}`;
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <SeverityBadge severity={item.severity} t={t} />
        <ConfidenceBadge level="high" t={t} />
        <SourceBadge source="confirmed" t={t} />
      </div>
      <Link href={href} className="mt-1.5 block text-sm font-semibold text-ink hover:underline">
        {title}
      </Link>
      <div className="mt-1 grid gap-x-6 gap-y-1 text-xs text-ink-2 md:grid-cols-2">
        <p>
          <span className="text-muted">{t.dashboard.evidence}: </span>
          {evidence.length ? evidence.join(" · ") : "—"}
        </p>
        <p>
          <span className="text-muted">{t.dashboard.recommendedAction}: </span>
          {action}
        </p>
        <p>
          <span className="text-muted">{t.dashboard.responsible}: </span>
          {loc(locale, item.responsible, item.responsibleAr) || "—"}
        </p>
        <p>
          <span className="text-muted">{t.dashboard.status}: </span>
          {t.dashboard.statusLive}
        </p>
      </div>
    </li>
  );
}

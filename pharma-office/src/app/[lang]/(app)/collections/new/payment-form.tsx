"use client";

import { useActionState, useMemo, useState } from "react";
import { recordPaymentAction, type PaymentFormState } from "@/server/actions/payments";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/form";
import { allocateFifo } from "@/lib/domain/allocation";
import { formatIQDExact } from "@/lib/domain/money";
import { interpolate, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Options = {
  drugstores: { id: number; name: string; nameAr: string }[];
  openInvoices: {
    id: number;
    drugstoreId: number;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    netAmount: number;
    paidAmount: number;
    isDisputed: boolean;
  }[];
};

type Labels = {
  form: Dictionary["payments"]["form"];
  methods: Dictionary["paymentMethod"];
  status: Dictionary["paymentStatus"];
  inv: Dictionary["invoices"];
  forbidden: string;
};

const METHODS = ["bank_transfer", "cheque", "cash", "other"] as const;

export function PaymentForm({
  lang,
  today,
  initialDrugstore,
  options,
  labels,
}: {
  lang: Locale;
  today: string;
  initialDrugstore: string;
  options: Options;
  labels: Labels;
}) {
  const [state, action, pending] = useActionState<PaymentFormState, FormData>(recordPaymentAction, {});
  const [drugstoreId, setDrugstoreId] = useState(initialDrugstore);
  const [amount, setAmount] = useState("");
  const name = (en: string, ar: string | null) => (lang === "ar" ? ar || en : en);

  const open = useMemo(
    () => options.openInvoices.filter((i) => String(i.drugstoreId) === drugstoreId),
    [options.openInvoices, drugstoreId],
  );
  const amountNum = Number(amount.replace(/[,\s]/g, ""));
  const preview = drugstoreId && Number.isFinite(amountNum) && amountNum > 0 ? allocateFifo(amountNum, open) : null;
  const allocatedById = new Map(preview?.allocations.map((a) => [a.invoiceId, a.amount]));

  const fe = state.fieldErrors ?? {};
  const errorText = state.error
    ? state.error === "drugstoreScope"
      ? labels.form.errors.drugstoreScope
      : state.error === "futureDate"
        ? labels.form.errors.futureDate
        : state.error === "forbidden"
          ? labels.forbidden
          : labels.form.errors.generic
    : null;

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <input type="hidden" name="lang" value={lang} />
      <div className="space-y-4">
        <div>
          <Label htmlFor="drugstoreId">{labels.form.drugstore}</Label>
          <Select id="drugstoreId" name="drugstoreId" required value={drugstoreId} onChange={(e) => setDrugstoreId(e.target.value)}>
            <option value="">—</option>
            {options.drugstores.map((d) => (
              <option key={d.id} value={d.id}>{name(d.name, d.nameAr)}</option>
            ))}
          </Select>
          <FieldError message={fe.drugstoreId} />
        </div>
        <div>
          <Label htmlFor="amount">{labels.form.amount}</Label>
          <Input id="amount" name="amount" inputMode="numeric" required dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <FieldError message={fe.amount} />
        </div>
        <div>
          <Label htmlFor="paymentDate">{labels.form.date}</Label>
          <Input id="paymentDate" name="paymentDate" type="date" required max={today} defaultValue={today} />
          <FieldError message={fe.paymentDate} />
        </div>
        <div>
          <Label htmlFor="method">{labels.form.method}</Label>
          <Select id="method" name="method" required defaultValue="bank_transfer">
            {METHODS.map((m) => (
              <option key={m} value={m}>{labels.methods[m]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="reference">{labels.form.reference}</Label>
          <Input id="reference" name="reference" maxLength={120} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="notes">{labels.form.notes}</Label>
          <Textarea id="notes" name="notes" maxLength={1000} />
        </div>
        {errorText ? (
          <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
            {errorText}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? labels.form.submitting : labels.form.submit}
        </Button>
      </div>

      <section aria-live="polite" className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{labels.form.preview}</h2>
        {!drugstoreId ? (
          <p className="mt-2 text-sm text-muted">{labels.form.previewEmpty}</p>
        ) : open.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{labels.form.noOpenInvoices}</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-2 py-1.5 text-start">{labels.inv.number}</th>
                  <th className="px-2 py-1.5 text-start">{labels.inv.dueDate}</th>
                  <th className="px-2 py-1.5 text-end">{labels.inv.outstanding}</th>
                  <th className="px-2 py-1.5 text-end">{labels.form.preview}</th>
                </tr>
              </thead>
              <tbody>
                {open.map((i) => {
                  const alloc = allocatedById.get(i.id);
                  return (
                    <tr key={i.id} className={alloc ? "bg-good-soft/60" : undefined}>
                      <td className="border-t border-line px-2 py-1.5" dir="ltr">
                        {i.invoiceNumber}
                        {i.isDisputed ? <span className="ms-2 text-[11px] text-estimated">{labels.status.disputed}</span> : null}
                      </td>
                      <td className={`border-t border-line px-2 py-1.5 ${i.dueDate < today ? "text-bad" : ""}`}>{i.dueDate}</td>
                      <td className="num border-t border-line px-2 py-1.5 text-end">{formatIQDExact(i.netAmount - i.paidAmount)}</td>
                      <td className="num border-t border-line px-2 py-1.5 text-end font-semibold">{alloc ? formatIQDExact(alloc) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {preview && preview.unallocated > 0 ? (
          <p className="mt-2 rounded-md bg-warn-soft px-3 py-2 text-xs text-warn">
            {interpolate(labels.form.willRemainOnAccount, { amount: formatIQDExact(preview.unallocated) })}
          </p>
        ) : null}
      </section>
    </form>
  );
}

"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createInvoiceAction, type InvoiceFormState } from "@/server/actions/invoices";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/form";
import { computeLine, sumLines, type LineTotals } from "@/lib/domain/pricing";
import { addDays } from "@/lib/domain/dates";
import { formatIQDExact } from "@/lib/domain/money";
import { interpolate, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Options = {
  drugstores: { id: number; name: string; nameAr: string; paymentTermDays: number; assignedRepId: string | null }[];
  skus: { id: number; code: string; packSize: string; listPrice: number; productName: string; productNameAr: string | null }[];
  batches: { id: number; skuId: number; batchNumber: string; expiryDate: string }[];
  reps: { id: string; fullName: string; fullNameAr: string | null }[];
};

type Labels = {
  form: Dictionary["invoices"]["form"];
  inv: Dictionary["invoices"];
  common: Dictionary["common"];
  forbidden: string;
};

type Line = { key: number; skuId: string; batchId: string; quantity: string; bonusQuantity: string; unitPrice: string; discountPct: string };

const emptyLine = (key: number): Line => ({ key, skuId: "", batchId: "", quantity: "", bonusQuantity: "0", unitPrice: "", discountPct: "0" });

export function InvoiceForm({ lang, today, options, labels }: { lang: Locale; today: string; options: Options; labels: Labels }) {
  const [state, action, pending] = useActionState<InvoiceFormState, FormData>(createInvoiceAction, {});
  const [drugstoreId, setDrugstoreId] = useState("");
  const [repId, setRepId] = useState("");
  const [term, setTerm] = useState("90");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [lines, setLines] = useState<Line[]>([emptyLine(1)]);
  const [nextKey, setNextKey] = useState(2);
  const name = (en: string, ar: string | null) => (lang === "ar" ? ar || en : en);

  const skuById = useMemo(() => new Map(options.skus.map((s) => [String(s.id), s])), [options.skus]);

  const computed: (LineTotals | null)[] = lines.map((l) => {
    const sku = skuById.get(l.skuId);
    const q = Number(l.quantity);
    if (!sku || !Number.isInteger(q) || q <= 0) return null;
    try {
      return computeLine({
        quantity: q,
        bonusQuantity: Number(l.bonusQuantity) || 0,
        unitPrice: l.unitPrice === "" ? sku.listPrice : Number(l.unitPrice),
        listPrice: sku.listPrice,
        discountPct: Number(l.discountPct) || 0,
      });
    } catch {
      return null;
    }
  });
  const totals = sumLines(computed.filter((c): c is LineTotals => c !== null));
  const delivered = computed.reduce((a, c) => a + (c?.deliveredUnits ?? 0), 0);

  const payload = JSON.stringify(
    lines.map((l) => {
      const sku = skuById.get(l.skuId);
      return {
        skuId: l.skuId,
        batchId: l.batchId || null,
        quantity: l.quantity,
        bonusQuantity: l.bonusQuantity || "0",
        unitPrice: l.unitPrice === "" ? (sku?.listPrice ?? "") : l.unitPrice,
        discountPct: l.discountPct || "0",
      };
    }),
  );

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const errorText = (() => {
    if (!state.error) return null;
    const [code, line] = state.error.split(":");
    const e = labels.form.errors;
    switch (code) {
      case "duplicateNumber": return e.duplicateNumber;
      case "drugstoreScope": return e.drugstoreScope;
      case "noLines": return e.noLines;
      case "batchMismatch": return interpolate(e.batchMismatch, { line });
      case "batchExpired": return interpolate(e.batchExpired, { line });
      case "forbidden": return labels.forbidden;
      default: return e.generic;
    }
  })();
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="lines" value={payload} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label htmlFor="drugstoreId">{labels.inv.drugstore}</Label>
          <Select
            id="drugstoreId"
            name="drugstoreId"
            required
            value={drugstoreId}
            onChange={(e) => {
              setDrugstoreId(e.target.value);
              const store = options.drugstores.find((d) => String(d.id) === e.target.value);
              if (store) {
                setTerm(String(store.paymentTermDays));
                setRepId(store.assignedRepId ?? "");
              }
            }}
          >
            <option value="">{labels.form.selectDrugstore}</option>
            {options.drugstores.map((d) => (
              <option key={d.id} value={d.id}>{name(d.name, d.nameAr)}</option>
            ))}
          </Select>
          <FieldError message={fe.drugstoreId} />
        </div>
        <div>
          <Label htmlFor="invoiceDate">{labels.inv.date}</Label>
          <Input id="invoiceDate" name="invoiceDate" type="date" required max={today} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          <FieldError message={fe.invoiceDate} />
        </div>
        <div>
          <Label htmlFor="paymentTermDays">{labels.inv.paymentTerm}</Label>
          <Input id="paymentTermDays" name="paymentTermDays" type="number" min={0} max={365} required value={term} onChange={(e) => setTerm(e.target.value)} />
          <p className="mt-1 text-xs text-muted">
            {labels.inv.dueDate}: <span className="num">{/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) && term !== "" ? addDays(invoiceDate, Number(term)) : "—"}</span>
          </p>
        </div>
        <div>
          <Label htmlFor="invoiceNumber">{labels.form.invoiceNumber}</Label>
          <Input id="invoiceNumber" name="invoiceNumber" dir="ltr" maxLength={48} placeholder="INV-…" />
          <p className="mt-1 text-xs text-muted">{labels.form.invoiceNumberHelp}</p>
          <FieldError message={fe.invoiceNumber} />
        </div>
        <div>
          <Label htmlFor="repId">{labels.inv.rep}</Label>
          <Select id="repId" name="repId" value={repId} onChange={(e) => setRepId(e.target.value)}>
            <option value="">—</option>
            {options.reps.map((r) => (
              <option key={r.id} value={r.id}>{name(r.fullName, r.fullNameAr)}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="notes">{labels.inv.notes}</Label>
          <Textarea id="notes" name="notes" maxLength={1000} className="min-h-9" rows={1} />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-semibold text-ink">{labels.inv.lines}</legend>
        {lines.map((l, i) => {
          const sku = skuById.get(l.skuId);
          const batchOptions = options.batches.filter((b) => String(b.skuId) === l.skuId && b.expiryDate > invoiceDate);
          const c = computed[i];
          return (
            <div key={l.key} className="rounded-md border border-line p-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.4fr_repeat(4,minmax(0,1fr))_auto]">
                <div>
                  <Label htmlFor={`sku-${l.key}`}>{labels.inv.sku}</Label>
                  <Select id={`sku-${l.key}`} required value={l.skuId} onChange={(e) => update(l.key, { skuId: e.target.value, batchId: "", unitPrice: "" })}>
                    <option value="">{labels.form.selectSku}</option>
                    {options.skus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {name(s.productName, s.productNameAr)} — {s.packSize}
                      </option>
                    ))}
                  </Select>
                  <FieldError message={fe[`lines.${i}.skuId`]} />
                </div>
                <div>
                  <Label htmlFor={`batch-${l.key}`}>{labels.inv.batch}</Label>
                  <Select id={`batch-${l.key}`} value={l.batchId} onChange={(e) => update(l.key, { batchId: e.target.value })} disabled={!sku}>
                    <option value="">{labels.form.noBatch}</option>
                    {batchOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batchNumber} · {labels.inv.expiry} {b.expiryDate}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`qty-${l.key}`}>{labels.inv.qty}</Label>
                  <Input id={`qty-${l.key}`} type="number" min={1} step={1} required inputMode="numeric" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} />
                  <FieldError message={fe[`lines.${i}.quantity`]} />
                </div>
                <div>
                  <Label htmlFor={`bonus-${l.key}`}>{labels.inv.bonus}</Label>
                  <Input id={`bonus-${l.key}`} type="number" min={0} step={1} inputMode="numeric" value={l.bonusQuantity} onChange={(e) => update(l.key, { bonusQuantity: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor={`price-${l.key}`}>{labels.inv.invoicePrice}</Label>
                  <Input
                    id={`price-${l.key}`}
                    type="number"
                    min={0}
                    step={50}
                    inputMode="numeric"
                    placeholder={sku ? String(sku.listPrice) : ""}
                    value={l.unitPrice}
                    onChange={(e) => update(l.key, { unitPrice: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor={`disc-${l.key}`}>{labels.inv.discountPct}</Label>
                  <Input id={`disc-${l.key}`} type="number" min={0} max={100} step={0.5} inputMode="decimal" value={l.discountPct} onChange={(e) => update(l.key, { discountPct: e.target.value })} />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}
                    disabled={lines.length === 1}
                    aria-label={labels.form.removeLine}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
              {c && sku ? (
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
                  <span>{labels.inv.listPrice}: <span className="num">{formatIQDExact(sku.listPrice)}</span></span>
                  <span>{labels.inv.lineNet}: <span className="num font-semibold">{formatIQDExact(c.netAmount)}</span></span>
                  <span>{labels.form.deliveredUnits}: <span className="num">{c.deliveredUnits}</span></span>
                  <span>
                    {labels.inv.effectivePrice}: <span className="num font-semibold">{formatIQDExact(c.effectiveUnitPrice)}</span>
                    {c.effectiveDiscountVsListPct > 0 ? <span className="text-muted"> (−{c.effectiveDiscountVsListPct.toFixed(1)}%)</span> : null}
                  </span>
                </p>
              ) : null}
            </div>
          );
        })}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setLines((ls) => [...ls, emptyLine(nextKey)]);
            setNextKey((k) => k + 1);
          }}
        >
          <Plus className="size-4" aria-hidden />
          {labels.form.addLine}
        </Button>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-canvas px-4 py-3 text-sm">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>{labels.inv.gross}: <span className="num font-semibold">{formatIQDExact(totals.grossAmount)}</span></span>
          <span>{labels.inv.discount}: <span className="num font-semibold">{formatIQDExact(totals.discountAmount)}</span></span>
          <span>{labels.inv.net}: <span className="num font-semibold">{formatIQDExact(totals.netAmount)}</span></span>
          <span>{labels.form.deliveredUnits}: <span className="num font-semibold">{delivered}</span></span>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? labels.form.submitting : labels.form.submit}
        </Button>
      </div>
      {errorText ? (
        <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
          {errorText}
        </p>
      ) : null}
    </form>
  );
}

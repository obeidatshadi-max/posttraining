import { Card, CardBody } from "@/components/ui/card";
import { AccessDenied } from "@/components/data/access-denied";
import { PageHeader } from "@/components/data/page-header";
import { pageContext, readSearch } from "@/lib/page-context";
import { paymentFormOptions } from "@/server/queries/payments";
import { PaymentForm } from "./payment-form";

export default async function NewPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, t, user, today, allowed } = await pageContext(params, "payments.record");
  if (!allowed) return <AccessDenied t={t} />;
  const [options, sp] = await Promise.all([paymentFormOptions(user), readSearch(searchParams)]);
  const preselected = options.drugstores.some((d) => String(d.id) === sp.drugstore) ? sp.drugstore! : "";
  return (
    <div>
      <PageHeader title={t.payments.form.title} subtitle={t.payments.form.subtitle} />
      <Card>
        <CardBody>
          <PaymentForm
            lang={locale}
            today={today}
            initialDrugstore={preselected}
            options={options}
            labels={{
              form: t.payments.form,
              methods: t.paymentMethod,
              status: t.paymentStatus,
              inv: t.invoices,
              forbidden: t.errors.accessDeniedBody,
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}

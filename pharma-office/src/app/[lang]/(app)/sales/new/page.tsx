import { Card, CardBody } from "@/components/ui/card";
import { AccessDenied } from "@/components/data/access-denied";
import { PageHeader } from "@/components/data/page-header";
import { pageContext } from "@/lib/page-context";
import { invoiceFormOptions } from "@/server/queries/invoices";
import { InvoiceForm } from "./invoice-form";

export default async function NewInvoicePage({ params }: { params: Promise<{ lang: string }> }) {
  const { locale, t, user, today, allowed } = await pageContext(params, "invoices.create");
  if (!allowed) return <AccessDenied t={t} />;
  const options = await invoiceFormOptions(user, today);
  return (
    <div>
      <PageHeader title={t.invoices.form.title} subtitle={t.invoices.form.subtitle} />
      <Card>
        <CardBody>
          <InvoiceForm
            lang={locale}
            today={today}
            options={options}
            labels={{ form: t.invoices.form, inv: t.invoices, common: t.common, forbidden: t.errors.accessDeniedBody }}
          />
        </CardBody>
      </Card>
    </div>
  );
}

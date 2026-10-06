import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { AccessDenied } from "@/components/data/access-denied";
import { Notice, PageHeader } from "@/components/data/page-header";
import { formatDate, loc } from "@/lib/format";
import { pageContext } from "@/lib/page-context";
import { listUsers } from "@/server/queries/admin";

export default async function SettingsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { locale, t, allowed } = await pageContext(params, "settings.view");
  if (!allowed) return <AccessDenied t={t} />;
  const users = await listUsers();
  return (
    <div className="space-y-5">
      <PageHeader title={t.settings.title} />
      <Card>
        <CardHeader title={t.settings.usersTitle} subtitle={t.settings.readOnly} />
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{t.settings.name}</Th>
                <Th>{t.settings.email}</Th>
                <Th>{t.settings.role}</Th>
                <Th className="hidden md:table-cell">{t.settings.territory}</Th>
                <Th>{t.settings.status}</Th>
                <Th className="hidden md:table-cell">{t.settings.lastLogin}</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <Tr key={u.id}>
                  <Td className="font-medium text-ink">{loc(locale, u.fullName, u.fullNameAr)}</Td>
                  <Td dir="ltr" className="text-start">{u.email}</Td>
                  <Td>{t.roles[u.role]}</Td>
                  <Td className="hidden md:table-cell">{u.territoryEn ? loc(locale, u.territoryEn, u.territoryAr) : t.common.all}</Td>
                  <Td>
                    <Badge tone={u.active ? "good" : "neutral"}>{u.active ? t.common.active : t.common.inactive}</Badge>
                  </Td>
                  <Td className="hidden whitespace-nowrap md:table-cell">
                    {u.lastLoginAt ? formatDate(u.lastLoginAt.toISOString(), locale) : t.settings.never}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
      <Card>
        <CardHeader title={t.settings.importTitle} />
        <div className="p-4">
          <Notice tone="phase">{t.settings.importPending}</Notice>
        </div>
      </Card>
    </div>
  );
}

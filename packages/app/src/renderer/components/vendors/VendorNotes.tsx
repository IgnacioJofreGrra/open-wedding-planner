import { useRequest } from "../../hooks/useRequest";
import { Card, CardContent } from "../common/Card";
import { Skeleton } from "../common/Skeleton";
import { useI18n } from "../../i18n/use-i18n";

interface ResearchNote {
  id: number;
  content: string;
  source: string | null;
  createdAt: string;
}

export function VendorNotes({ vendorId }: { vendorId: number }) {
  const { t } = useI18n();
  const { data: vendor } = useRequest<{ notes: string | null }>("vendors.get", {
    id: vendorId,
  });

  if (!vendor?.notes) {
    return <p className="text-sm text-on-surface-tertiary py-4">{t("vendor.notes.empty")}</p>;
  }

  return (
    <Card>
      <CardContent>
        <p className="text-sm text-on-surface-secondary whitespace-pre-wrap">{vendor.notes}</p>
      </CardContent>
    </Card>
  );
}

import { useI18n } from "../../i18n/use-i18n";
import type { TranslationKey } from "../../stores/ui-language-store";

const STATUS_CONFIG: Record<string, { key: TranslationKey; bg: string; text: string }> = {
  researched: { key: "vendor.status.researched", bg: "bg-blue-400/15", text: "text-blue-400" },
  contacted: { key: "vendor.status.contacted", bg: "bg-amber-400/15", text: "text-amber-400" },
  quoted: { key: "vendor.status.quoted", bg: "bg-gray-400/15", text: "text-gray-400" },
  booked: { key: "vendor.status.booked", bg: "bg-emerald-400/15", text: "text-emerald-400" },
  rejected: { key: "vendor.status.rejected", bg: "bg-red-400/15", text: "text-red-400" },
};

export function VendorStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const config = STATUS_CONFIG[status];
  const label = config ? t(config.key) : status;

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config?.bg ?? "bg-gray-400/15"} ${config?.text ?? "text-gray-400"}`}>
      {label}
    </span>
  );
}

import { Trash2 } from "lucide-react";
import { CurrencyDisplay } from "../common/CurrencyDisplay";
import { Badge } from "../common/Badge";
import { useI18n } from "../../i18n/use-i18n";

interface BudgetEntry {
  id: number;
  description: string;
  highEstimate: number | null;
  lowEstimate: number | null;
  estimatedActual: number | null;
  amountPaid: number | null;
  balanceDue: number | null;
  notes: string | null;
}

export function BudgetVendorRow({
  entry,
  currency,
  onDelete,
}: {
  entry: BudgetEntry;
  currency: string;
  onDelete: (id: number) => void;
}) {
  const { t } = useI18n();
  const notes = (entry.notes ?? "").toLowerCase();
  const description = entry.description.toLowerCase();
  const hasIva = notes.includes("iva") || description.includes("iva");
  const isRefundable = notes.includes("reembols") || description.includes("reembols");

  return (
    <tr className="border-b border-border-subtle text-sm group">
      <td className="w-1/6 py-2 pl-10 pr-4 text-on-surface-secondary">
        <div className="flex items-center gap-2 flex-wrap">
          <span>{entry.description}</span>
          {hasIva && <Badge variant="info">{t("budget.tag.iva")}</Badge>}
          {isRefundable && <Badge variant="success">{t("budget.tag.refundable")}</Badge>}
          <button
            onClick={() => onDelete(entry.id)}
            className="rounded p-1 text-on-surface-faint opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>
      <td className="w-1/6 py-2 px-4 text-right">
        <CurrencyDisplay amount={entry.highEstimate} currency={currency} className="text-on-surface-secondary" />
      </td>
      <td className="w-1/6 py-2 px-4 text-right">
        <CurrencyDisplay amount={entry.lowEstimate} currency={currency} className="text-on-surface-secondary" />
      </td>
      <td className="w-1/6 py-2 px-4 text-right">
        <CurrencyDisplay amount={entry.estimatedActual} currency={currency} />
      </td>
      <td className="w-1/6 py-2 px-4 text-right">
        <CurrencyDisplay amount={entry.amountPaid} currency={currency} />
      </td>
      <td className="w-1/6 py-2 px-4 text-right">
        <CurrencyDisplay amount={entry.balanceDue} currency={currency} />
      </td>
    </tr>
  );
}

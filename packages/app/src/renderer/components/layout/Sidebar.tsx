import {
  LayoutDashboard,
  Search,
  Store,
  MessageCircle,
  Phone,
  Inbox,
  Calendar,
  DollarSign,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import { useI18n } from "../../i18n/use-i18n";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { to: "/research", icon: Search, labelKey: "nav.research" },
  { to: "/vendors", icon: Store, labelKey: "nav.vendors" },
  { to: "/whatsapp", icon: MessageCircle, labelKey: "nav.whatsapp" },
  { to: "/calls", icon: Phone, labelKey: "nav.calls" },
  { to: "/inbox", icon: Inbox, labelKey: "nav.inbox" },
  { to: "/timeline", icon: Calendar, labelKey: "nav.timeline" },
  { to: "/budget", icon: DollarSign, labelKey: "nav.budget" },
] as const;

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { t } = useI18n();

  return (
    <aside
      className={`flex h-full flex-col border-r border-border bg-surface transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-4">
        {!collapsed && (
          <span className="text-sm font-semibold text-on-surface truncate">
            Open Wedding Planner
          </span>
        )}
        <button
          onClick={onToggle}
          className="ml-auto text-on-surface-secondary hover:text-on-surface p-1 rounded hover:bg-surface-hover"
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map((item) => (
          <SidebarItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={t(item.labelKey)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div className="border-t border-border px-2 py-3 space-y-1">
<SidebarItem
          to="/settings"
          icon={Settings}
          label={t("nav.settings")}
          collapsed={collapsed}
        />
      </div>
    </aside>
  );
}

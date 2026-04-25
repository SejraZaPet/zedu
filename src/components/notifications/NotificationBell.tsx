import { useNavigate } from "react-router-dom";
import { Bell, ClipboardList, CheckCircle2, AlertCircle, BookOpen, UserPlus, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications, Notification } from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";

const TYPE_META: Record<string, { Icon: any; color: string }> = {
  assignment_new: { Icon: ClipboardList, color: "#2563eb" },
  assignment_submitted: { Icon: CheckCircle2, color: "#16a34a" },
  assignment_deadline_soon: { Icon: AlertCircle, color: "#ea580c" },
  class_textbook_added: { Icon: BookOpen, color: "#9333ea" },
  class_teacher_invited: { Icon: UserPlus, color: "#0d9488" },
  admin_message: { Icon: Megaphone, color: "#6b7280" },
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();

  const sorted = [...notifications].sort((a, b) => {
    if (!!a.read_at !== !!b.read_at) return a.read_at ? 1 : -1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const top5 = sorted.slice(0, 5);

  const handleClick = async (n: Notification) => {
    if (!n.read_at) await markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative px-2 text-muted-foreground hover:text-primary" aria-label="Notifikace">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center text-[10px] font-bold text-white rounded-full"
              style={{
                background: "#dc2626",
                minWidth: "18px",
                height: "18px",
                padding: "0 4px",
                lineHeight: 1,
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="p-0" style={{ width: "380px" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-semibold text-sm">Notifikace</span>
          {unreadCount > 0 && (
            <button
              onClick={(e) => { e.preventDefault(); markAllAsRead(); }}
              className="text-xs text-primary hover:underline"
            >
              Označit vše
            </button>
          )}
        </div>
        <div style={{ maxHeight: "440px", overflowY: "auto" }}>
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Načítání…</div>
          ) : top5.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Žádné notifikace</div>
          ) : (
            top5.map((n) => {
              const meta = TYPE_META[n.type] ?? TYPE_META.admin_message;
              const Icon = meta.Icon;
              const unread = !n.read_at;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="w-full text-left px-4 py-3 border-b border-border hover:bg-muted/40 transition-colors flex gap-3"
                  style={unread ? { background: "rgba(59,130,246,0.04)" } : undefined}
                >
                  <div
                    className="flex-shrink-0 flex items-center justify-center rounded-full"
                    style={{ width: 32, height: 32, background: meta.color + "1a", color: meta.color }}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm leading-tight ${unread ? "font-semibold text-foreground" : "text-foreground"}`}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{n.body}</div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: cs })}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
        <div className="px-4 py-2 border-t border-border">
          <button
            onClick={() => navigate("/notifikace")}
            className="text-sm text-primary hover:underline w-full text-center"
          >
            Zobrazit všechny →
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;

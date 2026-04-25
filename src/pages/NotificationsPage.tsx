import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useNotifications, Notification } from "@/hooks/use-notifications";
import { ClipboardList, CheckCircle2, AlertCircle, BookOpen, UserPlus, Megaphone, Trash2, Check, BellOff } from "lucide-react";
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

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, remove } = useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filtered = filter === "unread" ? notifications.filter(n => !n.read_at) : notifications;

  const handleClick = async (n: Notification) => {
    if (!n.read_at) await markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto max-w-3xl px-4 pt-24 pb-12">
        <h1 className="text-3xl font-bold mb-6">Notifikace</h1>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              Vše ({notifications.length})
            </Button>
            <Button
              variant={filter === "unread" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("unread")}
            >
              Nepřečtené ({unreadCount})
            </Button>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <Check size={16} className="mr-1.5" />
              Označit vše jako přečtené
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Načítání…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BellOff size={48} className="mx-auto mb-3 opacity-40" />
            <p>{filter === "unread" ? "Žádné nepřečtené notifikace" : "Zatím žádné notifikace"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => {
              const meta = TYPE_META[n.type] ?? TYPE_META.admin_message;
              const Icon = meta.Icon;
              const unread = !n.read_at;
              return (
                <div
                  key={n.id}
                  className="bg-card border border-border rounded-xl p-4 flex gap-4 hover:shadow-sm transition-shadow"
                  style={unread ? { borderLeft: `4px solid ${meta.color}` } : undefined}
                >
                  <div
                    className="flex-shrink-0 flex items-center justify-center rounded-full"
                    style={{ width: 44, height: 44, background: meta.color + "1a", color: meta.color }}
                  >
                    <Icon size={20} />
                  </div>
                  <button
                    onClick={() => handleClick(n)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className={`text-base ${unread ? "font-semibold" : "font-medium"}`}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{n.body}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: cs })}
                    </div>
                  </button>
                  <div className="flex flex-col gap-1">
                    {unread && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(n.id)}
                        title="Přečíst"
                      >
                        <Check size={16} />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" title="Smazat">
                          <Trash2 size={16} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Smazat notifikaci?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tato akce je nevratná.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Zrušit</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(n.id)}>Smazat</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default NotificationsPage;

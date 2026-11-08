import DashboardBanners from "@/components/dashboard/DashboardBanners";
import BannersNewsButton from "@/components/dashboard/BannersNewsButton";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  User, GraduationCap, School, BarChart3, CalendarDays, FileText, Bell,
  Library, GripVertical, Timer, SquareCheckBig, Gamepad2, WandSparkles,
  Book, List, Landmark, ClipboardCheck, type LucideIcon,
} from "lucide-react";
import TeacherDashboardTile from "@/components/dashboard/TeacherDashboardTile";
import { EMPTY_DASHBOARD_COUNTS, loadTeacherDashboardCounts } from "@/lib/teacher-dashboard-counts";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TodayWidget from "@/components/calendar/TodayWidget";
import ProfileAvatarBubble from "@/components/profile/ProfileAvatarBubble";
import { useAuth } from "@/contexts/AuthContext";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { mergeTeacherDashboardOrder } from "@/lib/teacher-dashboard-order";

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  school: string;
}

const STORAGE_KEY = "teacher-dashboard-widget-order-v1";

const DEFAULT_ORDER = [
  "today",
  "classroom-tools",
  "subjects",
  "textbooks",
  "activities",
  "assignments",
  "classes",
  "results",
  "calendar",
  "worksheets",
  "lesson-plans",
  "suggest-method",
  "svp",
  "academy",
  "todos",
  "notifications",
  "profile",
];

const FULL_WIDTH_IDS = new Set(["today", "profile"]);

interface SortableWrapperProps {
  id: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const SortableWrapper = ({ id, fullWidth, children }: SortableWrapperProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative group", fullWidth && "col-span-full")}
    >
      <Button
        variant="ghost"
        size="icon"
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Přesunout widget"
        className="absolute top-1 left-1 z-10 min-h-11 min-w-11 text-foreground bg-background/90 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
      >
        <GripVertical className="w-4 h-4" />
      </Button>
      {children}
    </div>
  );
};

interface CardConfig {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  to: string;
}

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState(EMPTY_DASHBOARD_COUNTS);
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: string[] = JSON.parse(raw);
        const merged = mergeTeacherDashboardOrder(saved, DEFAULT_ORDER);
        setOrder(merged);
      }
    } catch {}
  }, []);

  const persistOrder = (next: string[]) => {
    setOrder(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    supabase
      .from("profiles")
      .select("first_name, last_name, email, school")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as Profile);
        setLoading(false);
      });
  }, [authLoading, user, navigate]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    setCounts(EMPTY_DASHBOARD_COUNTS);
    if (!user || authLoading) return;
    let cancelled = false;
    const refresh = () => {
      void loadTeacherDashboardCounts(user.id).then((next) => {
        if (!cancelled) setCounts(next);
      });
    };
    refresh();
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [user?.id, authLoading]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Načítání...</div>
      </div>
    );
  }

  const isLektor = role === "lektor";

  const cards: Record<string, CardConfig> = {
    subjects: {
      id: "subjects", icon: Library, title: "Moje předměty",
      description: "Přehled vyučovaných předmětů.", to: "/ucitel/predmety",
    },
    "classroom-tools": {
      id: "classroom-tools",
      icon: Timer,
      title: "Nástroje do hodiny",
      description: "Odpočet, stopky, losování, skupiny, megatext a měřič hlasitosti.",
      to: "/ucitel/nastroje",
    },
    textbooks: {
      id: "textbooks",
      icon: Book,
      title: "Moje učebnice",
      description: "Spravujte a upravujte své digitální učebnice.",
      to: "/ucitel/ucebnice",
    },
    activities: {
      id: "activities",
      icon: Gamepad2,
      title: "Moje aktivity",
      description: "Vytvářejte kvízy a interaktivní úkoly pro studenty.",
      to: "/aktivity",
    },
    assignments: {
      id: "assignments",
      icon: SquareCheckBig,
      title: "Úlohy pro žáky",
      description: "Zadávejte a spravujte úkoly, testy a pracovní listy pro žáky.",
      to: "/ucitel/ulohy",
    },
    classes: {
      id: "classes",
      icon: School,
      title: "Moje třídy",
      description: "Spravujte třídy a sledujte pokrok studentů.",
      to: "/ucitel/tridy",
    },
    results: {
      id: "results",
      icon: BarChart3,
      title: "Výsledky studentů",
      description: "Sledujte úspěšnost a dokončené aktivity.",
      to: "/ucitel/vysledky",
    },
    calendar: {
      id: "calendar",
      icon: CalendarDays,
      title: "Můj kalendář",
      description: "Rozvrh tříd a termíny zadaných úkolů.",
      to: "/ucitel/kalendar",
    },
    worksheets: {
      id: "worksheets",
      icon: FileText,
      title: "Pracovní listy",
      description: "Tvořte a spravujte pracovní listy pro výuku i domácí úkoly.",
      to: "/ucitel/pracovni-listy",
    },
    "lesson-plans": {
      id: "lesson-plans",
      icon: List,
      title: "Plány hodin",
      description: "Organizujte lekce do tematických plánů hodin.",
      to: "/ucitel/plany-hodin",
    },
    "suggest-method": {
      id: "suggest-method",
      icon: WandSparkles,
      title: "Návrh podle metody",
      description: "AI navrhne strukturu lekce podle zvolené výukové metody (Bloom, Flipped, projektová výuka…).",
      to: "/ucitel/navrh-podle-metody",
    },
    svp: {
      id: "svp",
      icon: Landmark,
      title: "ŠVP k předmětům",
      description: "Uložte si školní vzdělávací plán ke každému předmětu – text nebo soubor.",
      to: "/ucitel/svp",
    },
    academy: {
      id: "academy",
      icon: GraduationCap,
      title: "Bezli Akademie",
      description: "Kurzy a webináře pro učitele – rozvíjejte se s Bezli.",
      to: "/ucitel/akademie",
    },
    todos: {
      id: "todos",
      icon: ClipboardCheck,
      title: "Moje úkoly",
      description: "Osobní seznam úkolů, příprav a termínů.",
      to: "/todo",
    },
    notifications: {
      id: "notifications",
      icon: Bell,
      title: "Moje notifikace",
      description: "Pošlete zprávu nebo připomenutí třídě či konkrétním žákům.",
      to: "/ucitel/notifikace",
    },
  };

  const renderWidget = (id: string) => {
    if (id === "today") {
      return (
        <div className="bg-card border border-border rounded-xl p-1">
          <TodayWidget role="teacher" />
        </div>
      );
    }

    if (id === "profile") {
      return (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand-sm flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-heading text-lg font-semibold">Můj profil</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm items-center">
            <div>
              <span className="text-muted-foreground block">Jméno</span>
              <span>
                {profile?.first_name} {profile?.last_name}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">E-mail</span>
              <span>{profile?.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Škola</span>
              <span>{profile?.school || "—"}</span>
            </div>
            <div>
              <Button onClick={() => navigate("/profil")} variant="outline" size="sm">
                Upravit profil
              </Button>
            </div>
          </div>
        </div>
      );
    }

    const card = cards[id];
    if (!card) return null;
    return (
      <TeacherDashboardTile icon={card.icon} title={card.title}
        description={card.description} to={card.to}
        count={id === "assignments" ? counts.assignments : id === "todos" ? counts.todos : id === "notifications" ? counts.notifications : null} />
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    persistOrder(arrayMove(order, oldIndex, newIndex));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-12 max-w-5xl"
        style={{ paddingTop: "calc(70px + 3rem)" }}
      >
        <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <ProfileAvatarBubble userId={user?.id ?? null} size={72} crop="head" showEditButton={false} showStreakBadge={false} />
            <div>
              <h1 className="font-heading text-3xl font-bold">
                Ahoj, {profile?.first_name || (isLektor ? "lektore" : "učiteli")}! 👋
              </h1>
              <p className="text-muted-foreground mt-1">
                {isLektor ? "Lektorský panel" : "Učitelský panel"} · widgety lze přesouvat
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BannersNewsButton />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => persistOrder(DEFAULT_ORDER)}
            >
              Obnovit pořadí
            </Button>
          </div>
        </div>

        <DashboardBanners />

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="teacher-dashboard-grid">
              {[...order.filter(id => id !== "profile"), "profile"].map((id) => (
                <SortableWrapper key={id} id={id} fullWidth={FULL_WIDTH_IDS.has(id)}>
                  {renderWidget(id)}
                </SortableWrapper>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherDashboard;

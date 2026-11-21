import DashboardBanners from "@/components/dashboard/DashboardBanners";
import BannersNewsButton from "@/components/dashboard/BannersNewsButton";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  User, GraduationCap, School, BarChart3, CalendarDays, FileText, Bell,
  Library, GripVertical, Timer, SquareCheckBig, Gamepad2, WandSparkles,
  Book, List, Landmark, ClipboardCheck, ListChecks, type LucideIcon,
} from "lucide-react";
import TeacherDashboardTile, { type TeacherTileTone } from "@/components/dashboard/TeacherDashboardTile";
import { DashboardCompactTile } from "@/components/dashboard/DashboardTile";
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
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createDefaultTeacherDashboardOrder,
  migrateTeacherDashboardOrder,
  moveTeacherDashboardTile,
  parseTeacherDashboardOrder,
  serializeTeacherDashboardOrder,
  TEACHER_DASHBOARD_LEGACY_STORAGE_KEY,
  TEACHER_DASHBOARD_STORAGE_KEY,
  type TeacherDashboardGroup,
  type TeacherDashboardOrder,
} from "@/lib/teacher-dashboard-order";

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  school: string;
}

interface SortableWrapperProps {
  id: string;
  children: ReactNode;
}

const SortableWrapper = ({ id, children }: SortableWrapperProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative group min-w-0">
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
  tone?: TeacherTileTone;
}

const GROUP_LABELS: Record<Exclude<TeacherDashboardGroup, "priority">, string> = {
  teaching: "Vyučuji dnes",
  preparation: "Příprava hodin",
  classes: "Třídy a předměty",
  personal: "Pro mě",
};

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState(EMPTY_DASHBOARD_COUNTS);
  const [order, setOrder] = useState<TeacherDashboardOrder>(createDefaultTeacherDashboardOrder);

  useEffect(() => {
    try {
      const rawV2 = localStorage.getItem(TEACHER_DASHBOARD_STORAGE_KEY);
      const savedV2 = parseTeacherDashboardOrder(rawV2);
      const savedV1 = parseTeacherDashboardOrder(localStorage.getItem(TEACHER_DASHBOARD_LEGACY_STORAGE_KEY));
      const restored = migrateTeacherDashboardOrder(savedV2 ?? savedV1);
      setOrder(restored);
      if (!rawV2 && savedV1 !== undefined) {
        localStorage.setItem(TEACHER_DASHBOARD_STORAGE_KEY, serializeTeacherDashboardOrder(restored));
      }
    } catch {
      setOrder(createDefaultTeacherDashboardOrder());
    }
  }, []);

  const persistOrder = (next: TeacherDashboardOrder) => {
    setOrder(next);
    try {
      localStorage.setItem(TEACHER_DASHBOARD_STORAGE_KEY, serializeTeacherDashboardOrder(next));
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
      description: "Přehled vyučovaných předmětů.", to: "/ucitel/predmety", tone: "subjects",
    },
    "classroom-tools": {
      id: "classroom-tools",
      icon: Timer,
      title: "Nástroje do hodiny",
      description: "Odpočet, losování, skupiny",
      to: "/ucitel/nastroje",
    },
    textbooks: {
      id: "textbooks",
      icon: Book,
      title: "Moje učebnice",
      description: "Spravujte a upravujte své digitální učebnice.",
      to: "/ucitel/ucebnice",
      tone: "textbooks",
    },
    activities: {
      id: "activities",
      icon: Gamepad2,
      title: "Studio",
      description: "Aktivity a hry: kvízy, hry a úkoly pro žáky.",
      to: "/ucitel/studio",
    },
    assignments: {
      id: "assignments",
      icon: SquareCheckBig,
      title: "Úlohy pro žáky",
      description: "Zadat a spravovat",
      to: "/ucitel/ulohy",
      tone: "assignments",
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
      title: "Výsledky",
      description: "Úspěšnost žáků",
      to: "/ucitel/vysledky",
    },
    review: {
      id: "review",
      icon: ListChecks,
      title: "Ke kontrole",
      description: "Odevzdané úkoly čekající na kontrolu",
      to: "/ucitel/ke-kontrole",
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

  const countFor = (id: string) => {
    if (id === "assignments") return counts.assignments;
    if (id === "todos") return counts.todos;
    if (id === "notifications") return counts.notifications;
    return null;
  };

  const countLabelFor = (id: string) => {
    if (id === "assignments") return "počet zveřejněných úloh";
    if (id === "todos") return "počet nevyřízených úkolů";
    return "počet nepřečtených notifikací";
  };

  const renderTile = (id: string, tone: TeacherTileTone, wide = false) => {
    const card = cards[id];
    if (!card) return null;
    return (
      <SortableWrapper key={id} id={id}>
        <TeacherDashboardTile
          id={id}
          icon={card.icon}
          title={card.title}
          description={card.description}
          to={card.to}
          tone={card.tone ?? tone}
          wide={wide}
          count={countFor(id)}
          countLabel={countLabelFor(id)}
        />
      </SortableWrapper>
    );
  };

  const renderCompactTile = (id: string) => {
    const card = cards[id];
    if (!card) return null;
    return (
      <SortableWrapper key={id} id={id}>
        <DashboardCompactTile
          id={id}
          icon={card.icon}
          title={card.title}
          to={card.to}
          count={countFor(id)}
          countLabel={countLabelFor(id)}
          testIdPrefix="teacher"
        />
      </SortableWrapper>
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const next = moveTeacherDashboardTile(order, String(active.id), String(over.id));
    if (next !== order) persistOrder(next);
  };

  const renderSortableGroup = (group: Exclude<TeacherDashboardGroup, "priority" | "personal">, tone: TeacherTileTone) => (
    <section className="teacher-dashboard-section" aria-labelledby={`teacher-group-${group}`} data-testid={`teacher-group-${group}`}>
      <h2 id={`teacher-group-${group}`} className="teacher-dashboard-section-heading">{GROUP_LABELS[group]}</h2>
      <SortableContext items={order[group]} strategy={rectSortingStrategy}>
        <div className="dashboard-main-grid">
          {order[group].map((id) => renderTile(id, tone))}
        </div>
      </SortableContext>
    </section>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-12 max-w-6xl"
        style={{ paddingTop: "calc(70px + 3rem)" }}
      >
        <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <ProfileAvatarBubble
              userId={user?.id ?? null}
              size={96}
              shape="square"
              crop="head"
              showEditButton={false}
              showStreakBadge={false}
            />
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
            <Button variant="ghost" size="sm" onClick={() => persistOrder(createDefaultTeacherDashboardOrder())}>
              Obnovit pořadí
            </Button>
          </div>
        </div>

        <DashboardBanners />

        <div data-testid="teacher-today-slot">
          <TodayWidget role="teacher" />
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <section aria-label="Hlavní nástroje" data-testid="teacher-priority-links">
            <SortableContext items={order.priority} strategy={rectSortingStrategy}>
              <div className="teacher-dashboard-wide-grid">
                {order.priority.map((id) => renderTile(id, id === "activities" ? "studio" : "review", true))}
              </div>
            </SortableContext>
          </section>

          {renderSortableGroup("teaching", "teaching")}
          {renderSortableGroup("preparation", "preparation")}
          {renderSortableGroup("classes", "classes")}

          <section className="teacher-dashboard-section" aria-labelledby="teacher-group-personal" data-testid="teacher-group-personal">
            <h2 id="teacher-group-personal" className="teacher-dashboard-section-heading">{GROUP_LABELS.personal}</h2>
            <SortableContext items={order.personal} strategy={rectSortingStrategy}>
              <div className="dashboard-compact-grid teacher-dashboard-personal-grid">
                {order.personal.map(renderCompactTile)}
              </div>
            </SortableContext>
          </section>
        </DndContext>

        <section className="bg-card border border-border rounded-xl p-6 mt-8" aria-labelledby="teacher-profile-heading">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand-sm flex items-center justify-center">
              <User className="w-5 h-5 text-primary-foreground" />
            </div>
            <h2 id="teacher-profile-heading" className="font-heading text-lg font-semibold">Můj profil</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm items-center">
            <div>
              <span className="text-muted-foreground block">Jméno</span>
              <span>{profile?.first_name} {profile?.last_name}</span>
            </div>
            <div className="min-w-0">
              <span className="text-muted-foreground block">E-mail</span>
              <span className="break-all">{profile?.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Škola</span>
              <span>{profile?.school || "—"}</span>
            </div>
            <div>
              <Button onClick={() => navigate("/profil")} variant="outline" size="sm">Upravit profil</Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherDashboard;

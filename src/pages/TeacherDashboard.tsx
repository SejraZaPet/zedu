import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  User,
  GraduationCap,
  Sparkles,
  School,
  BarChart3,
  ListTodo,
  CalendarDays,
  FileText,
  Bell,
  BookOpen,
  Library,
  GripVertical,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TodayWidget from "@/components/calendar/TodayWidget";
import { useAuth } from "@/contexts/AuthContext";
import { useTeacherSubjects } from "@/hooks/useTeacherSubjects";
import { useTeacherClasses } from "@/hooks/useTeacherClasses";
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

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  school: string;
}

const STORAGE_KEY = "teacher-dashboard-widget-order-v1";

const DEFAULT_ORDER = [
  "today",
  "subjects",
  "textbooks",
  "activities",
  "classes",
  "results",
  "calendar",
  "worksheets",
  "lesson-plans",
  "todos",
  "notifications",
  "profile",
];

const FULL_WIDTH_IDS = new Set(["today", "profile"]);

const colorForLabel = (s: string) => {
  const palette = ["#6EC6D9", "#9B6CFF", "#F472B6", "#F87171", "#FB923C", "#FBBF24", "#34D399", "#60A5FA", "#A3A3A3"];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};

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
      className={cn("relative group", fullWidth && "md:col-span-2")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Přesunout widget"
        className="absolute top-2 right-2 z-10 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      {children}
    </div>
  );
};

interface CardConfig {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  button: string;
  onClick: () => void;
}

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { subjects } = useTeacherSubjects();
  const { classes } = useTeacherClasses();
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: string[] = JSON.parse(raw);
        // Merge: keep saved order, append any new ids
        const merged = [
          ...saved.filter((id) => DEFAULT_ORDER.includes(id)),
          ...DEFAULT_ORDER.filter((id) => !saved.includes(id)),
        ];
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

  const subjectClassCounts = useMemo(() => {
    // No direct mapping subject->class; show total classes as fallback per subject
    return classes.length;
  }, [classes]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Načítání...</div>
      </div>
    );
  }

  const isLektor = role === "lektor";

  const cards: Record<string, CardConfig> = {
    textbooks: {
      id: "textbooks",
      icon: GraduationCap,
      title: "Moje učebnice",
      description: "Spravujte a upravujte své digitální učebnice.",
      button: "Otevřít učebnice",
      onClick: () => navigate("/ucitel/ucebnice"),
    },
    activities: {
      id: "activities",
      icon: Sparkles,
      title: "Moje aktivity",
      description: "Vytvářejte kvízy a interaktivní úkoly pro studenty.",
      button: "Otevřít aktivity",
      onClick: () => navigate("/ucitel/ucebnice"),
    },
    classes: {
      id: "classes",
      icon: School,
      title: "Moje třídy",
      description: "Spravujte třídy a sledujte pokrok studentů.",
      button: "Spravovat třídy",
      onClick: () => navigate("/ucitel/tridy"),
    },
    results: {
      id: "results",
      icon: BarChart3,
      title: "Výsledky studentů",
      description: "Sledujte úspěšnost a dokončené aktivity.",
      button: "Zobrazit výsledky",
      onClick: () => navigate("/ucitel/vysledky"),
    },
    calendar: {
      id: "calendar",
      icon: CalendarDays,
      title: "Můj kalendář",
      description: "Rozvrh tříd a termíny zadaných úkolů.",
      button: "Otevřít kalendář",
      onClick: () => navigate("/ucitel/kalendar"),
    },
    worksheets: {
      id: "worksheets",
      icon: FileText,
      title: "Pracovní listy",
      description: "Tvořte a spravujte pracovní listy pro výuku i domácí úkoly.",
      button: "Otevřít",
      onClick: () => navigate("/ucitel/pracovni-listy"),
    },
    "lesson-plans": {
      id: "lesson-plans",
      icon: BookOpen,
      title: "Plány hodin",
      description: "Organizujte lekce do tematických plánů hodin.",
      button: "Otevřít plány",
      onClick: () => navigate("/ucitel/plany-hodin"),
    },
    todos: {
      id: "todos",
      icon: ListTodo,
      title: "Moje úkoly",
      description: "Osobní seznam úkolů, příprav a termínů.",
      button: "Otevřít úkoly",
      onClick: () => navigate("/todo"),
    },
    notifications: {
      id: "notifications",
      icon: Bell,
      title: "Moje notifikace",
      description: "Pošlete zprávu nebo připomenutí třídě či konkrétním žákům.",
      button: "Otevřít notifikace",
      onClick: () => navigate("/ucitel/notifikace"),
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

    if (id === "subjects") {
      return (
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center">
              <Library className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-heading text-lg font-semibold">Moje předměty</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4 flex-1">
            Přehled vyučovaných předmětů.
          </p>
          <Button onClick={() => navigate("/ucitel/predmety")} variant="outline" className="w-full">
            Otevřít předměty
          </Button>
        </div>
      );
    }

    if (id === "profile") {
      return (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center">
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
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center">
            <card.icon className="w-5 h-5 text-white" />
          </div>
          <h2 className="font-heading text-lg font-semibold">{card.title}</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4 flex-1">{card.description}</p>
        <Button onClick={card.onClick} variant="outline" className="w-full">
          {card.button}
        </Button>
      </div>
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
          <div>
            <h1 className="font-heading text-3xl font-bold">
              Ahoj, {profile?.first_name || (isLektor ? "lektore" : "učiteli")}! 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              {isLektor ? "Lektorský panel" : "Učitelský panel"} · widgety lze přesouvat
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => persistOrder(DEFAULT_ORDER)}
          >
            Obnovit pořadí
          </Button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="grid gap-6 md:grid-cols-2">
              {order.map((id) => (
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

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/slugify";

interface Props {
  lessonId: string;
  buttonText?: string;
}

const LessonLinkButton = ({ lessonId, buttonText }: Props) => {
  const navigate = useNavigate();

  const { data: lesson } = useQuery({
    queryKey: ["lesson-link", lessonId],
    queryFn: async () => {
      if (!lessonId) return null;
      const { data } = await supabase
        .from("textbook_lessons")
        .select("id, title, status, topic_id, textbook_topics(subject, grade, title)")
        .eq("id", lessonId)
        .maybeSingle();
      return data;
    },
    enabled: !!lessonId,
  });

  if (!lesson || lesson.status !== "published") return null;

  const topic = lesson.textbook_topics as any;
  const url = `/ucebnice/${topic?.subject}/${topic?.grade}/${slugify(topic?.title || "")}/${slugify(lesson.title)}`;
  const label = buttonText || lesson.title;

  return (
    <div className="flex justify-center">
      <button
        onClick={() => navigate(url)}
        className="w-full max-w-xl px-8 py-4 rounded-full bg-foreground text-background font-semibold text-lg border-2 border-primary/0 hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
      >
        {label}
      </button>
    </div>
  );
};

export default LessonLinkButton;

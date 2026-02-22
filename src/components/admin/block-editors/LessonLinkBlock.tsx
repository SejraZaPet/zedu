import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Block } from "@/lib/textbook-config";

interface LessonOption {
  id: string;
  title: string;
  topicTitle: string;
}

interface Props {
  block: Block;
  onChange: (props: Record<string, any>) => void;
}

const LessonLinkBlock = ({ block, onChange }: Props) => {
  const [lessons, setLessons] = useState<LessonOption[]>([]);

  useEffect(() => {
    supabase
      .from("textbook_lessons")
      .select("id, title, textbook_topics(title)")
      .order("title")
      .then(({ data }) => {
        if (data) {
          setLessons(
            data.map((l: any) => ({
              id: l.id,
              title: l.title,
              topicTitle: l.textbook_topics?.title ?? "",
            }))
          );
        }
      });
  }, []);

  const selected = lessons.find((l) => l.id === block.props.lessonId);

  return (
    <div className="space-y-3">
      <div>
        <Label>Cílová lekce</Label>
        <Select
          value={block.props.lessonId || ""}
          onValueChange={(v) => onChange({ ...block.props, lessonId: v })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Vyberte lekci…" />
          </SelectTrigger>
          <SelectContent>
            {lessons.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.title} {l.topicTitle ? `(${l.topicTitle})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Text tlačítka (volitelné)</Label>
        <Input
          value={block.props.buttonText || ""}
          onChange={(e) => onChange({ ...block.props, buttonText: e.target.value })}
          placeholder={selected?.title || "Použije se název lekce"}
          className="mt-1"
        />
      </div>
    </div>
  );
};

export default LessonLinkBlock;

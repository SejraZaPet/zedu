import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Batch načte avatar_slug pro seznam user_id. Klíč = user_id, hodnota = slug. */
export const useStudentAvatars = (userIds: (string | null | undefined)[]) => {
  const [avatars, setAvatars] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = Array.from(new Set(userIds.filter((x): x is string => !!x)));
    if (ids.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("student_avatars")
        .select("student_id, avatar_slug")
        .in("student_id", ids);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => {
        map[r.student_id] = r.avatar_slug;
      });
      setAvatars(map);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIds.join(",")]);

  return avatars;
};

export const useStudentAvatar = (userId: string | null | undefined) => {
  const [slug, setSlug] = useState<string>("bear");
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("student_avatars")
        .select("avatar_slug")
        .eq("student_id", userId)
        .maybeSingle();
      if (data?.avatar_slug) setSlug(data.avatar_slug);
    })();
  }, [userId]);
  return slug;
};

// Synchronizace testovacího žáka do aktivních tříd a skupin jeho vlastníka.
// Přidá chybějící členství, odebere členství mimo vlastníkovy třídy/skupiny.

export function membershipDiff(target: Iterable<string>, current: Iterable<string>) {
  const t = new Set(target);
  const c = new Set(current);
  return {
    add: [...t].filter((id) => !c.has(id)),
    remove: [...c].filter((id) => !t.has(id)),
  };
}

// deno-lint-ignore no-explicit-any
export async function syncPreviewMemberships(db: any, ownerId: string, studentId: string) {
  const [created, taught, groups, curC, curG] = await Promise.all([
    db.from("classes").select("id").eq("created_by", ownerId).eq("archived", false).eq("is_demo_seed", false),
    db.from("class_teachers").select("class_id, classes!inner(archived, is_demo_seed)").eq("user_id", ownerId)
      .eq("classes.archived", false).eq("classes.is_demo_seed", false),
    db.from("subject_groups").select("id").eq("created_by", ownerId).eq("archived", false).eq("is_demo_seed", false),
    db.from("class_members").select("class_id").eq("user_id", studentId),
    db.from("subject_group_members").select("group_id").eq("student_id", studentId),
  ]);
  for (const r of [created, taught, groups, curC, curG]) if (r.error) throw new Error(r.error.message);

  const classIds = new Set<string>([
    ...(created.data ?? []).map((r: { id: string }) => r.id),
    ...(taught.data ?? []).map((r: { class_id: string }) => r.class_id),
  ]);
  const c = membershipDiff(classIds, (curC.data ?? []).map((r: { class_id: string }) => r.class_id));
  const g = membershipDiff(
    (groups.data ?? []).map((r: { id: string }) => r.id),
    (curG.data ?? []).map((r: { group_id: string }) => r.group_id),
  );

  if (c.add.length) {
    const { error } = await db.from("class_members")
      .upsert(c.add.map((class_id) => ({ class_id, user_id: studentId })), { onConflict: "class_id,user_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  if (c.remove.length) {
    const { error } = await db.from("class_members").delete().eq("user_id", studentId).in("class_id", c.remove);
    if (error) throw new Error(error.message);
  }
  if (g.add.length) {
    const { error } = await db.from("subject_group_members").insert(g.add.map((group_id) => ({ group_id, student_id: studentId })));
    if (error) throw new Error(error.message);
  }
  if (g.remove.length) {
    const { error } = await db.from("subject_group_members").delete().eq("student_id", studentId).in("group_id", g.remove);
    if (error) throw new Error(error.message);
  }
  await db.from("profiles").update({ school_id: null }).eq("id", studentId);
  return { classes: classIds.size, groups: (groups.data ?? []).length, added: c.add.length + g.add.length, removed: c.remove.length + g.remove.length };
}

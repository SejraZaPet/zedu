-- Access helper for textbook content
create or replace function public.can_access_textbooks(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = _user_id
      and p.status = 'approved'
  )
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = 'admin'
  );
$$;

-- Replace public read policies with protected textbook access

drop policy if exists "Anyone can read textbook_subjects" on public.textbook_subjects;
create policy "Approved users can read textbook_subjects"
on public.textbook_subjects
for select
to authenticated
using (public.can_access_textbooks(auth.uid()));

drop policy if exists "Anyone can read textbook_grades" on public.textbook_grades;
create policy "Approved users can read textbook_grades"
on public.textbook_grades
for select
to authenticated
using (public.can_access_textbooks(auth.uid()));

drop policy if exists "Anyone can read textbook_topics" on public.textbook_topics;
create policy "Approved users can read textbook_topics"
on public.textbook_topics
for select
to authenticated
using (public.can_access_textbooks(auth.uid()));

drop policy if exists "Anyone can read textbook_lessons" on public.textbook_lessons;
create policy "Approved users can read textbook_lessons"
on public.textbook_lessons
for select
to authenticated
using (public.can_access_textbooks(auth.uid()));

drop policy if exists "Anyone can read lesson_topic_assignments" on public.lesson_topic_assignments;
create policy "Approved users can read lesson_topic_assignments"
on public.lesson_topic_assignments
for select
to authenticated
using (public.can_access_textbooks(auth.uid()));

-- Legacy lessons table (if still used by any route/component)
drop policy if exists "Anyone can read lessons" on public.lessons;
create policy "Approved users can read lessons"
on public.lessons
for select
to authenticated
using (public.can_access_textbooks(auth.uid()));
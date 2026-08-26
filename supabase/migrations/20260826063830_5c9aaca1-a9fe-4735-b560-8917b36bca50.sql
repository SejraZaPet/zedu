ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
  'assignment_new','assignment_submitted','assignment_deadline_soon','class_textbook_added',
  'class_teacher_invited','admin_message','reminder','message','warning','info','update',
  'hand_raised','inactive_student','struggling_topic','content_shared','creator_follow',
  'class_story_new','todo_assigned','todo_deadline_soon'
]));

CREATE TABLE public.student_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('inactive', 'struggling_topic')),
  context text,
  detail text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_alerts_student ON public.student_alerts(student_id);
CREATE INDEX idx_student_alerts_class ON public.student_alerts(class_id);
CREATE INDEX idx_student_alerts_open ON public.student_alerts(resolved, created_at DESC) WHERE resolved = false;
CREATE INDEX idx_student_alerts_type_student ON public.student_alerts(student_id, alert_type, context, resolved);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_alerts TO authenticated;
GRANT ALL ON public.student_alerts TO service_role;

ALTER TABLE public.student_alerts ENABLE ROW LEVEL SECURITY;

-- Teachers: read alerts for students in classes they teach
CREATE POLICY "Teachers read alerts for their class students"
  ON public.student_alerts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_members cm
      JOIN public.class_teachers ct ON ct.class_id = cm.class_id
      WHERE cm.user_id = student_alerts.student_id
        AND ct.user_id = auth.uid()
    )
    OR (class_id IS NOT NULL AND public.is_class_teacher(class_id, auth.uid()))
  );

-- Parents: read alerts for their linked child
CREATE POLICY "Parents read alerts for their child"
  ON public.student_alerts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      WHERE psl.parent_id = auth.uid()
        AND psl.student_id = student_alerts.student_id
    )
  );

-- Teachers: mark as resolved for their students
CREATE POLICY "Teachers can resolve alerts for their students"
  ON public.student_alerts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_members cm
      JOIN public.class_teachers ct ON ct.class_id = cm.class_id
      WHERE cm.user_id = student_alerts.student_id
        AND ct.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.class_members cm
      JOIN public.class_teachers ct ON ct.class_id = cm.class_id
      WHERE cm.user_id = student_alerts.student_id
        AND ct.user_id = auth.uid()
    )
  );

-- Admin full access
CREATE POLICY "Admins manage all student_alerts"
  ON public.student_alerts FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Schedule daily detection
SELECT cron.unschedule('detect-student-alerts-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'detect-student-alerts-daily'
);

SELECT cron.schedule(
  'detect-student-alerts-daily',
  '0 7 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://rnndtpfmkanxbckdbflm.supabase.co/functions/v1/detect-student-alerts',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubmR0cGZta2FueGJja2RiZmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODMwOTcsImV4cCI6MjA4ODU1OTA5N30.0Du0I5XHLyiiKFkoXjM1J8DMsGEiSJdm53BDkl0JCrA", "X-Cron-Secret": "sdoUdDh0IUX_z8Td9xw1wXjLqmiMGmqFHXnYaCgph6Q"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $cron$
);

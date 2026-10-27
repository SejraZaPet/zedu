CREATE OR REPLACE FUNCTION public.save_schedule_exception(_kind text, _source_id text, _original_date date, _action text, _new_date date, _new_start time without time zone, _new_end time without time zone, _reason text, _note text, _share boolean, _expected_revision integer, _request_id uuid, _plan_ids uuid[] DEFAULT '{}'::uuid[], _plan_action text DEFAULT 'unassigned'::text, _next_date date DEFAULT NULL::date)
 RETURNS schedule_exceptions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE src jsonb;ex public.schedule_exceptions;old_ex public.schedule_exceptions;p public.lesson_plans;anchors jsonb;a jsonb;next_src jsonb;ls text;td date;ts time;te time;matched boolean;
BEGIN
 src:=public.schedule_source_occurrence(_kind,_source_id,_original_date);
 IF _action NOT IN ('cancelled','moved','reverted') OR _request_id IS NULL OR _plan_action NOT IN ('unassigned','next') THEN RAISE EXCEPTION 'Neplatná změna.';END IF;
 IF coalesce(length(_reason),0)>500 OR coalesce(length(_note),0)>2000 OR coalesce(array_length(_plan_ids,1),0)>50 THEN RAISE EXCEPTION 'Příliš dlouhý údaj nebo mnoho plánů.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||_kind||_source_id||_original_date::text,0));
 SELECT * INTO old_ex FROM public.schedule_exceptions WHERE owner_id=auth.uid() AND source_kind=_kind AND source_id=_source_id AND original_date=_original_date FOR UPDATE;
 IF old_ex.id IS NOT NULL AND old_ex.request_id=_request_id THEN RETURN old_ex;END IF;
 IF coalesce(old_ex.revision,0)<>_expected_revision THEN RAISE EXCEPTION 'Hodina se mezitím změnila. Načtěte ji znovu.' USING ERRCODE='40001';END IF;
 IF _action='reverted' THEN
 IF old_ex.id IS NULL THEN RAISE EXCEPTION 'Není co vrátit.';END IF;
 UPDATE public.schedule_exceptions SET state='reverted',visible_to_students=false,reason_visible=false,revision=revision+1,request_id=_request_id,updated_at=now() WHERE id=old_ex.id RETURNING * INTO ex;
 UPDATE public.schedule_plan_occurrence_links SET state='reverted',revision=revision+1 WHERE exception_id=ex.id;RETURN ex;END IF;
 IF _action='moved' AND (_new_date IS NULL OR _new_start IS NULL OR _new_end IS NULL OR _new_end<=_new_start) THEN RAISE EXCEPTION 'Vyplňte platný nový termín.';END IF;
 IF _action='moved' AND extract(month FROM _new_date) IN (3,10) AND extract(isodow FROM _new_date)=7 AND extract(month FROM _new_date+7)<>extract(month FROM _new_date) AND ((_new_start>='02:00' AND _new_start<'03:00') OR (_new_end>='02:00' AND _new_end<'03:00')) THEN RAISE EXCEPTION 'Čas při změně letního/zimního času není jednoznačný nebo neexistuje.';END IF;
 INSERT INTO public.schedule_exceptions(owner_id,source_kind,source_id,class_slot_id,original_date,action,state,new_date,new_start,new_end,class_id,group_id,visible_to_students,reason_visible,public_reason,request_id)
 VALUES(auth.uid(),_kind,_source_id,CASE WHEN _kind='class_slot' THEN _source_id::uuid END,_original_date,_action,'active',CASE WHEN _action='moved' THEN _new_date END,CASE WHEN _action='moved' THEN _new_start END,CASE WHEN _action='moved' THEN _new_end END,(src->>'class_id')::uuid,(src->>'group_id')::uuid,coalesce(_share,true),false,coalesce(_reason,''),_request_id)
 ON CONFLICT(owner_id,source_kind,source_id,original_date) DO UPDATE SET action=excluded.action,state='active',new_date=excluded.new_date,new_start=excluded.new_start,new_end=excluded.new_end,visible_to_students=excluded.visible_to_students,reason_visible=false,public_reason=excluded.public_reason,request_id=excluded.request_id,revision=schedule_exceptions.revision+1,updated_at=now() RETURNING * INTO ex;
 INSERT INTO public.schedule_exception_notes(exception_id,owner_id,note) VALUES(ex.id,auth.uid(),coalesce(_note,'')) ON CONFLICT(exception_id) DO UPDATE SET note=excluded.note;
 IF _action='moved' THEN ls:='follow';td:=_new_date;ts:=_new_start;te:=_new_end;
 ELSIF _plan_action='next' THEN
 IF _next_date IS NULL OR _next_date<=_original_date THEN RAISE EXCEPTION 'Vyberte následující hodinu.';END IF;
 next_src:=public.schedule_source_occurrence(_kind,_source_id,_next_date);
 IF EXISTS(SELECT 1 FROM public.schedule_exceptions WHERE owner_id=auth.uid() AND source_kind=_kind AND source_id=_source_id AND original_date=_next_date AND state='active') THEN RAISE EXCEPTION 'Další hodina má vlastní změnu.';END IF;
 ls:='next';td:=_next_date;ts:=(next_src->>'start')::time;te:=(next_src->>'end')::time;
 ELSE ls:='unassigned';END IF;
 UPDATE public.schedule_plan_occurrence_links SET state=ls,effective_date=td,effective_start=ts,effective_end=te,revision=revision+1 WHERE exception_id=ex.id;
 FOR p IN SELECT * FROM public.lesson_plans WHERE id=ANY(_plan_ids) LOOP
 IF p.teacher_id<>auth.uid() OR NOT public.schedule_demo_access(p.teacher_id,p.class_id,p.group_id) THEN RAISE EXCEPTION 'Cizí plán nelze přesunout.' USING ERRCODE='42501';END IF;
 anchors:=coalesce(p.input_data->'linkedSlots','[]'::jsonb);matched:=false;
 IF nullif(p.input_data->>'linkedDate','') IS NOT NULL THEN anchors:=anchors||jsonb_build_array(jsonb_build_object('date',p.input_data->>'linkedDate','time',p.input_data->>'linkedTime','subject',p.subject,'classId',p.class_id,'groupId',p.group_id,'primary',true));END IF;
 FOR a IN SELECT value FROM jsonb_array_elements(anchors) LOOP
 IF a->>'date'=_original_date::text AND split_part(coalesce(a->>'time',''),'-',1)<>'' AND split_part(a->>'time','-',1)::time=(src->>'start')::time AND coalesce(nullif(a->>'classId','')::uuid,p.class_id) IS NOT DISTINCT FROM (src->>'class_id')::uuid AND coalesce(nullif(a->>'groupId','')::uuid,p.group_id) IS NOT DISTINCT FROM (src->>'group_id')::uuid AND lower(btrim(coalesce(a->>'subject',p.subject)))=lower(btrim(src->>'subject')) THEN
 matched:=true;
 IF EXISTS(SELECT 1 FROM public.schedule_plan_occurrence_links WHERE plan_id=p.id AND anchor=a AND exception_id<>ex.id AND state<>'reverted') THEN RAISE EXCEPTION 'Přiřazení plánu už bylo změněno jinde.';END IF;
 INSERT INTO public.schedule_plan_occurrence_links(owner_id,plan_id,exception_id,anchor,effective_date,effective_start,effective_end,state) VALUES(auth.uid(),p.id,ex.id,a,td,ts,te,ls)
 ON CONFLICT(plan_id,exception_id,anchor) DO UPDATE SET state=excluded.state,effective_date=excluded.effective_date,effective_start=excluded.effective_start,effective_end=excluded.effective_end,revision=schedule_plan_occurrence_links.revision+1;
 END IF;END LOOP;
 IF NOT matched THEN RAISE EXCEPTION 'Plán již neodpovídá původní hodině. Načtěte jej znovu.';END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.lesson_plans WHERE id=ANY(_plan_ids))<>coalesce(array_length(_plan_ids,1),0) THEN RAISE EXCEPTION 'Některý plán neexistuje.';END IF;
 RETURN ex;
END $function$;

CREATE OR REPLACE FUNCTION public.set_schedule_exception_reason_visible(_exception_id uuid, _visible boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.schedule_exceptions e
     SET reason_visible = coalesce(_visible,false) AND e.visible_to_students,
         updated_at = now()
   WHERE e.id = _exception_id AND e.owner_id = auth.uid() AND e.state = 'active'
     AND public.schedule_demo_access(e.owner_id, e.class_id, e.group_id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_schedule_exception_reason_visible(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_schedule_exception_reason_visible(uuid, boolean) TO authenticated;
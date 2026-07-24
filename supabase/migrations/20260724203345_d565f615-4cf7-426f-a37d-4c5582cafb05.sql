update public.landing_sections set props = jsonb_set(props, '{metrics}', '[
  {"icon":"Layers","value":"12+","label":"typů interaktivních aktivit"},
  {"icon":"Presentation","value":"Živě","label":"prezentace i domácí procvičování"},
  {"icon":"Users","value":"4","label":"propojené role"},
  {"icon":"Gift","value":"100%","label":"zdarma v betě"}
]'::jsonb) where section_type='social_proof';
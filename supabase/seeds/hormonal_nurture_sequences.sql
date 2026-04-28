-- ============================================================
-- Hormonal-assessment post-quiz nurture sequences
--
-- Four sequences, one per archetype. Each fires when score-assessment
-- finishes and matches its `trigger_type`. Three placeholder steps per
-- sequence (Day 0, Day 2, Day 5) for the nutritionist to fill in —
-- bodies marked "TODO:" so they're easy to find.
--
-- Run via Supabase Studio SQL Editor.
--
-- Re-run safe: deletes existing steps + sequences with these
-- trigger_types before inserting, so editing this file and re-running
-- rebuilds the sequences cleanly. Works whether or not the
-- automation_steps FK has ON DELETE CASCADE.
-- ============================================================

do $$
declare
  seq_id uuid;
  trig   text;
  triggers text[] := array[
    'hormonal_stress_driven',
    'hormonal_shift_pattern',
    'hormonal_metabolic',
    'hormonal_compound'
  ];
begin
  -- 1. Wipe any prior version of these sequences (and their steps).
  foreach trig in array triggers loop
    delete from public.automation_steps
      where sequence_id in (
        select id from public.automation_sequences where trigger_type = trig
      );
    delete from public.automation_sequences where trigger_type = trig;
  end loop;

  -- 2. Stress-Driven Plateau ────────────────────────────────
  insert into public.automation_sequences (name, trigger_type, is_active, description)
  values (
    'Hormonal — Stress-Driven Plateau',
    'hormonal_stress_driven',
    true,
    'Post-quiz nurture for women scored as Stress-Driven Plateau (cortisol-led pattern).'
  )
  returning id into seq_id;

  insert into public.automation_steps
    (sequence_id, step_order, channel, subject, body, delay_seconds, is_active)
  values
    (seq_id, 0, 'email',
     'Your Stress-Driven Plateau report — what to do first',
     'TODO: Day 0 email body. Open with the mirror-back of their cortisol pattern (belly storage, 2–4 AM wake, afternoon cravings). One protocol shift to make this week (sleep first lever). CTA to book strategy call.',
     0, true),
    (seq_id, 1, 'email',
     'The cortisol trap (and why you keep falling into it)',
     'TODO: Day 2 email body. Why "eat less, move more" backfires for cortisol-driven women. Two case studies. Soft CTA — reply with one question.',
     172800, true),
    (seq_id, 2, 'email',
     'Your protocol — if we worked together',
     'TODO: Day 5 email body. Outline the 12-week shape of a stress-driven protocol (strength + walking + sleep + protein-forward eating, no HIIT). Strong CTA to book the free strategy call.',
     432000, true);

  -- 3. Hormonal Shift Pattern ───────────────────────────────
  insert into public.automation_sequences (name, trigger_type, is_active, description)
  values (
    'Hormonal — Hormonal Shift Pattern',
    'hormonal_shift_pattern',
    true,
    'Post-quiz nurture for perimenopausal/menopausal women (estrogen-progesterone-testosterone shift).'
  )
  returning id into seq_id;

  insert into public.automation_steps
    (sequence_id, step_order, channel, subject, body, delay_seconds, is_active)
  values
    (seq_id, 0, 'email',
     'Your Hormonal Shift report — the rules just changed',
     'TODO: Day 0 email body. Mirror-back the cycle change, mood, fat redistribution. Reframe: "this is biology, not failure." Strength-training is the first lever. CTA to book.',
     0, true),
    (seq_id, 1, 'email',
     'Why "same calories, different result" makes sense',
     'TODO: Day 2 email body. Walk through how estrogen/testosterone changes alter fuel partitioning. Why cardio-first stops working. Two case studies of women in their 40s who flipped to strength.',
     172800, true),
    (seq_id, 2, 'email',
     'The 12-week perimenopause protocol',
     'TODO: Day 5 email body. Outline shape of protocol: strength 3x, protein at 1g/lb, sleep priority, optional bloodwork. Strong CTA to book the free strategy call.',
     432000, true);

  -- 4. Metabolic Resistance Pattern ─────────────────────────
  insert into public.automation_sequences (name, trigger_type, is_active, description)
  values (
    'Hormonal — Metabolic Resistance',
    'hormonal_metabolic',
    true,
    'Post-quiz nurture for the leptin/insulin-resistance plateau pattern.'
  )
  returning id into seq_id;

  insert into public.automation_steps
    (sequence_id, step_order, channel, subject, body, delay_seconds, is_active)
  values
    (seq_id, 0, 'email',
     'Your Metabolic Resistance report — why deficits stopped working',
     'TODO: Day 0 email body. Mirror-back the lose-then-plateau or lose-regain history, post-meal crashes, constant hunger. Reframe: signalling is broken, not willpower. CTA to book.',
     0, true),
    (seq_id, 1, 'email',
     'The leptin/insulin loop nobody told you about',
     'TODO: Day 2 email body. How dieting harder makes leptin worse. Case study: woman who plateaued at -10kg, broke through with re-feeds + strength. Soft CTA.',
     172800, true),
    (seq_id, 2, 'email',
     'Your protocol shift — the reverse-engineered plan',
     'TODO: Day 5 email body. Reverse diet outline. Strength + walking. Protein and timing-led eating. Why this works when deficits don''t. Strong CTA to book.',
     432000, true);

  -- 5. Compound Pattern ─────────────────────────────────────
  insert into public.automation_sequences (name, trigger_type, is_active, description)
  values (
    'Hormonal — Compound Pattern',
    'hormonal_compound',
    true,
    'Post-quiz nurture for the rare compound pattern (all three clusters within 20%). Recommend bloodwork.'
  )
  returning id into seq_id;

  insert into public.automation_steps
    (sequence_id, step_order, channel, subject, body, delay_seconds, is_active)
  values
    (seq_id, 0, 'email',
     'Your Compound Pattern report — the order matters',
     'TODO: Day 0 email body. Validate the "doing right things in wrong order" frame. Sequencing is everything. Recommend bloodwork before protocol. CTA to book.',
     0, true),
    (seq_id, 1, 'email',
     'Why multi-front protocols always failed you',
     'TODO: Day 2 email body. Treating all three at once = nothing moves. Treating in sequence (stress → metabolic → hormonal) = layers unlock. Case study.',
     172800, true),
    (seq_id, 2, 'email',
     'Your bloodwork shortlist + 12-week sequence',
     'TODO: Day 5 email body. Bloodwork: cortisol AM/PM, fasting insulin, HbA1c, sex hormones (cycle-day-3 if cycling). 12-week sequence outline. Strong CTA to book — we''ll review panel together.',
     432000, true);

end $$;

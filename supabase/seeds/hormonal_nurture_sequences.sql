-- ============================================================
-- Hormonal-assessment post-quiz nurture sequences
--
-- Four sequences, one per archetype. Each fires when score-assessment
-- finishes and matches its `trigger_type`. Three steps per sequence:
--   Day 0  — pattern mirror-back + first lever + CTA
--   Day 2  — deeper pattern explanation + case + soft CTA
--   Day 5  — protocol outline + strong CTA
--
-- Bodies are interpolated server-side via replaceVars():
--   {first_name}  → the lead's first name
--   {email}       → the lead's email
--   {phone}       → the lead's phone
-- (See score-assessment/index.ts.)
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
     'Hi {first_name},

Your assessment came back as a Stress-Driven Plateau — the cortisol-led pattern.

In short: your body isn''t holding fat because you''re eating too much. It''s holding fat because the stress signal won''t switch off. Belly storage, 2–4 AM wake-ups, afternoon cravings — all of it points to the same lever.

The single biggest shift you can make this week isn''t in your kitchen. It''s in your sleep. The next time you wake at 3 AM, don''t reach for your phone — that single habit drops cortisol fastest.

When you''re ready, the free 45-minute in-person consult is where we map your full protocol — sleep, training, eating — to your specific score:

https://reshape.fit/hormonal-assessment/result.html

— The ReShape team',
     0, true),
    (seq_id, 1, 'email',
     'The cortisol trap (and why you keep falling into it)',
     'Hi {first_name},

Quick one for you.

Most women in a stress-driven plateau have been told the answer is "eat less, move more." For your pattern, that''s the exact wrong dose. Restriction is itself a stressor — it raises cortisol further and the body holds fat harder.

We had a client last quarter (early 40s, two kids, classic 2 AM wake-up) who had been in a 600-cal deficit for 9 weeks. Scale hadn''t moved. We pulled her deficit back to 200 cals, added two 20-minute strength sessions, and put a non-negotiable 10pm phone-cutoff in place. She lost 3kg in the next month — not because she ate less, but because her body finally trusted she wasn''t under threat.

If you have one question about your pattern, hit reply. I read every one.

— Loai',
     172800, true),
    (seq_id, 2, 'email',
     'Your protocol — if we worked together',
     'Hi {first_name},

If we worked together on your stress-driven plateau, here''s the 12-week shape it would take.

Weeks 1–4: sleep + nervous-system reset. Magnesium, sleep window, no HIIT. Protein at every meal so you''re not running on empty. Walking, not cardio.

Weeks 5–8: strength training, 3x a week, full body. Heavy enough to matter, short enough to not spike cortisol. We start measuring strength, not just the scale.

Weeks 9–12: tighten the eating window, add deliberate recovery, check sleep markers. By now your body has stopped fighting the work — and the scale starts to follow.

This is the protocol shape. Your version of it gets dialled in in the consult.

Book your free 45-minute in-person consult here — we''ll go through your full pattern, agree the first 3 shifts, and tell you straight whether we''re a fit:

https://reshape.fit/hormonal-assessment/result.html

— Loai',
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
     'Hi {first_name},

Your assessment came back as a Hormonal Shift Pattern.

What you''re experiencing — cycle change, mood shifts, fat redistribution, training that used to work no longer working — isn''t willpower failure. It''s your body recalibrating hormones it has produced for decades.

This isn''t a smaller version of the same problem. It''s a different problem with different rules: the protocols that worked at 30 stop working at 42. Most women aren''t told this until five years too late.

The first lever is muscle. Not cardio, not fasting, not a smaller plate. Strength training is the one intervention that consistently flips this pattern — because muscle is what your shifting hormones are quietly demanding more of.

When you''re ready, the free 45-minute in-person consult is where we map your full pattern + protocol:

https://reshape.fit/hormonal-assessment/result.html

— The ReShape team',
     0, true),
    (seq_id, 1, 'email',
     'Why "same calories, different result" makes sense',
     'Hi {first_name},

Same food. Same training. Different body. It''s the most disorienting part of this shift.

Here''s the physiology: as estrogen drops, your insulin sensitivity drops with it — so the same carb load that used to glide through now lands on your hips and stays. As testosterone drops, your training stimulus has to work harder to build the same muscle. The number on the food label didn''t change. The rules of how your body uses it did.

Two clients in their mid-40s ran the same experiment last year: cut all conditioning, switched to 3 strength sessions a week, kept eating roughly the same amount but pushed protein to 1g per pound. Both lost 4–6kg over 16 weeks — the first sustained result either had seen since 38.

The cardio-first script wasn''t built for the hormones you have now.

— Loai',
     172800, true),
    (seq_id, 2, 'email',
     'The 12-week shift protocol',
     'Hi {first_name},

If we worked together on your hormonal shift, here''s the shape it would take over 12 weeks.

Weeks 1–4: build the strength base. Three full-body sessions a week. Heavy enough to count. We dial protein up to 1g per pound of bodyweight — most women in your stage are 30–40g a day under what they need.

Weeks 5–8: layer in walking + sleep priority. We don''t add cardio. We sometimes recommend a basic bloodwork panel here — it''s the inflection point where it pays for itself.

Weeks 9–12: refine training stimulus, refine eating windows, look at HRT/peri-supportive supplementation if relevant. By now you''ve usually got 2–3kg off and you''re lifting heavier than you have in a decade.

That''s the shape. Your version gets dialled to your scores in the consult.

Book your free 45-minute in-person consult here:

https://reshape.fit/hormonal-assessment/result.html

— Loai',
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
     'Hi {first_name},

Your assessment came back as a Metabolic Resistance Pattern.

In short: your body has stopped responding to the signals it should. Leptin (the "I''ve had enough" hormone) and insulin (the "store this" hormone) have stopped being heard properly. The result is what you''ve been living with — lose, regain, lose, plateau. Tired after meals. Hungry an hour later. Exercise barely moving the needle.

This isn''t willpower. It''s a signalling problem. And willpower is the wrong tool for it — every "eat less, push harder" cycle made the resistance louder, not quieter.

The first shift is to stop dieting harder. We need to feed the system back into communication before we ask it to change shape.

When you''re ready, the free 45-minute in-person consult is where we map your specific way out:

https://reshape.fit/hormonal-assessment/result.html

— The ReShape team',
     0, true),
    (seq_id, 1, 'email',
     'The leptin loop nobody told you about',
     'Hi {first_name},

Quick one.

The reason "just diet harder" stopped working for you isn''t a moral failing — it''s a thermostat. When you cut calories aggressively, leptin (your fullness hormone) drops. When leptin drops, your hunger goes up, your metabolism quietly slows, and your willpower buckles. The harder you push, the harder the loop pushes back.

We had a client who lost 10kg over 18 months and then sat at the same weight for two years no matter what she tried. We pulled her out of the deficit, brought her up to maintenance for 8 weeks, layered in strength, then ran a smaller, slower deficit. She''s 7kg down in the months since — without the constant hunger.

The plateau wasn''t broken with more discipline. It was broken by feeding the signal first.

— Loai',
     172800, true),
    (seq_id, 2, 'email',
     'Your protocol shift — the reverse-engineered plan',
     'Hi {first_name},

If we worked together on your metabolic resistance, here''s the 12-week shape.

Weeks 1–4: reverse diet. We bring calories up — usually 200–300 a day — and watch leptin recover. Counterintuitively, most clients lose body fat in this phase as their metabolism wakes back up.

Weeks 5–8: strength training, 3x a week. Walking 8–10k steps a day. We tighten protein to 1g per pound. Carbs stay in — they''re the lever, not the enemy. We''re building muscle that pulls glucose out of your blood for you.

Weeks 9–12: introduce a small, sustainable deficit. By now leptin and insulin are listening again, and the same 200-cal cut that did nothing in month one starts to actually move you.

This is the protocol shape. Your version gets dialled in the consult.

Book your free 45-minute in-person consult here:

https://reshape.fit/hormonal-assessment/result.html

— Loai',
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
     'Hi {first_name},

Your assessment came back as a Compound Pattern — about 1 in 10 women score this way.

Your symptoms span all three layers: stress signalling, hormonal shift, and metabolic resistance are all firing at once. Which is why every plan you''ve tried has only worked for a few weeks before the next layer caught up with you.

This isn''t a "do more, harder" problem. It''s an order problem. When all three are present, treating them in parallel means nothing moves. Treated in the right sequence — usually stress first, then metabolic, then hormonal — they unlock one layer at a time.

This is also the one pattern where a basic bloodwork panel almost always pays for itself before we set the plan. We''d talk through that in the consult.

When you''re ready, book your free 45-minute in-person consult here:

https://reshape.fit/hormonal-assessment/result.html

— The ReShape team',
     0, true),
    (seq_id, 1, 'email',
     'Why multi-front protocols always failed you',
     'Hi {first_name},

Quick one.

The trap with a compound pattern is intuitive: "if all three are wrong, fix all three at once." It''s the most common mistake — and it''s why nothing has held for you yet.

Treating all three at the same time means stress work raises your protein needs, metabolic work raises your stress, and hormonal work needs both to be in line first. It cancels out. You feel busy and nothing moves.

We had a client last year — late 40s, perimenopausal, history of yo-yo dieting, two kids, demanding job. Compound pattern. We refused to touch her diet for the first six weeks. We worked sleep and stress only. Once she was sleeping through, we layered metabolic — small reverse diet, walking, strength. By month four we had a frame for the hormonal piece. She''s 9kg down on the year.

The protocol didn''t work because it was harder. It worked because it was sequenced.

— Loai',
     172800, true),
    (seq_id, 2, 'email',
     'Your bloodwork shortlist + 12-week sequence',
     'Hi {first_name},

If we worked on your compound pattern, here''s how I''d sequence it.

Bloodwork to consider before we start: morning + evening cortisol (saliva or serum), fasting insulin, HbA1c, full thyroid (TSH/T4/T3), and sex hormones (cycle day 3 if you''re still cycling, anytime if you''re not). Most of this is a single panel — not as expensive as it sounds.

Weeks 1–4 (stress first): sleep window, magnesium, no HIIT, walking only. Protein at every meal. We do not touch the deficit.

Weeks 5–8 (metabolic): introduce strength training, 3x a week. Begin a slow reverse diet up to maintenance if you''ve been under-eating. Watch hunger and energy normalise.

Weeks 9–12 (hormonal): refine training, refine eating window, layer in any peri/menopausal-supportive interventions the bloodwork supports. By now the foundation is real and the hormonal piece has a chance of landing.

That''s the shape. The order, dialled to your scores, is what gets agreed in the consult.

Book your free 45-minute in-person consult here — we''ll review your assessment + any panel together:

https://reshape.fit/hormonal-assessment/result.html

— Loai',
     432000, true);

end $$;

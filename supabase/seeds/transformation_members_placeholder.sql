-- ============================================================
-- Placeholder rows for transformation_members.
--
-- Used by the consult-confirm page (/booking/confirm/) until real
-- member case studies are loaded. Re-run safe: deletes any rows
-- whose name starts with 'Placeholder' before inserting.
-- ============================================================

delete from public.transformation_members
 where name like 'Placeholder %';

insert into public.transformation_members
  (name, image_url, starting_point, goal, pattern_tag, display_order, active)
values
  -- Stress-driven plateau ─────────────────────────────────
  ('Placeholder A',
   'https://placehold.co/600x800/E8DDD0/2A2724?text=Member+A',
   'Belly weight that wouldn''t shift, despite training 4x/week',
   'Sleep through the night, drop a stone',
   'stress_driven_plateau', 10, true),
  ('Placeholder B',
   'https://placehold.co/600x800/E8DDD0/2A2724?text=Member+B',
   'Wired all day, knackered all evening, cravings at 4pm',
   'Get her energy back, lose 8kg',
   'stress_driven_plateau', 20, true),
  ('Placeholder C',
   'https://placehold.co/600x800/E8DDD0/2A2724?text=Member+C',
   'High-stress job, plateaued for 18 months',
   'Reshape around her stress, not against it',
   'stress_driven_plateau', 30, true),

  -- Hormonal shift ────────────────────────────────────────
  ('Placeholder D',
   'https://placehold.co/600x800/E8DDD0/2A2724?text=Member+D',
   'Same plan, different body — nothing worked anymore',
   'Find the version of training that works at 42',
   'hormonal_shift', 10, true),
  ('Placeholder E',
   'https://placehold.co/600x800/E8DDD0/2A2724?text=Member+E',
   'Cycle changes, mood crashes, weight settling differently',
   'Reshape around perimenopause',
   'hormonal_shift', 20, true),
  ('Placeholder F',
   'https://placehold.co/600x800/E8DDD0/2A2724?text=Member+F',
   '40s, lifelong active, suddenly stuck',
   'Build muscle, drop fat',
   'hormonal_shift', 30, true),

  -- Metabolic resistance ──────────────────────────────────
  ('Placeholder G',
   'https://placehold.co/600x800/E8DDD0/2A2724?text=Member+G',
   'Told her thyroid meant nothing would work',
   'A plan that finally responded',
   'metabolic_resistance', 10, true),
  ('Placeholder H',
   'https://placehold.co/600x800/E8DDD0/2A2724?text=Member+H',
   'Lost weight three times, regained it three times',
   'Break the cycle for good',
   'metabolic_resistance', 20, true),
  ('Placeholder I',
   'https://placehold.co/600x800/E8DDD0/2A2724?text=Member+I',
   'Energy crashes after every meal, plateaued 9 months',
   'Get her metabolism responding again',
   'metabolic_resistance', 30, true),

  -- Compound pattern ──────────────────────────────────────
  ('Placeholder J',
   'https://placehold.co/600x800/E8DDD0/2A2724?text=Member+J',
   'Tried everything — diets, trainers, supplements',
   'A plan that finally fit her body',
   'compound_pattern', 10, true),
  ('Placeholder K',
   'https://placehold.co/600x800/E8DDD0/2A2724?text=Member+K',
   'Multiple symptoms across stress, hormones, and metabolism',
   'Sequence the fix in the right order',
   'compound_pattern', 20, true),
  ('Placeholder L',
   'https://placehold.co/600x800/E8DDD0/2A2724?text=Member+L',
   'Three years of conflicting advice from different programmes',
   'One coherent protocol that holds',
   'compound_pattern', 30, true);

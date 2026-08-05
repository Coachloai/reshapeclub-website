-- Add men's archetype values to the assessments CHECK constraints.
-- Men's scoring produces: cortisol_dominant_decline, testosterone_decline,
-- metabolic_resistance_men, compound_pattern_men.

ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_primary_archetype_check;

ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_primary_archetype_check
  CHECK (primary_archetype IN (
    'stress_driven_plateau',
    'hormonal_shift',
    'metabolic_resistance',
    'compound_pattern',
    'cortisol_dominant_decline',
    'testosterone_decline',
    'metabolic_resistance_men',
    'compound_pattern_men'
  ));

ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_secondary_archetype_check;

ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_secondary_archetype_check
  CHECK (secondary_archetype IN (
    'stress_driven_plateau',
    'hormonal_shift',
    'metabolic_resistance',
    'cortisol_dominant_decline',
    'testosterone_decline',
    'metabolic_resistance_men',
    'compound_pattern_men'
  ));

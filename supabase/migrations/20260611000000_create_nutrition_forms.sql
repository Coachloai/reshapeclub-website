-- nutrition_forms — stores completed Nutrition Assessment responses

CREATE TABLE IF NOT EXISTS public.nutrition_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Identity
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  phone TEXT,
  emergency_contact_name TEXT,
  emergency_contact_number TEXT,

  -- Goals
  current_size TEXT,
  next_goal TEXT,
  motivation TEXT,
  target_date DATE,

  -- Diet
  breakfast TEXT,
  lunch TEXT,
  dinner TEXT,
  snacking TEXT,
  tea_coffee TEXT,
  food_weaknesses TEXT,
  diet_preference TEXT,
  past_diets TEXT,
  eating_out_frequency TEXT,
  eating_out_choices TEXT,
  alcohol TEXT,
  takeaways TEXT,
  meals_per_day TEXT,
  max_daily_meals TEXT,
  cooking_frequency TEXT,
  meal_types TEXT,
  dietary_challenges TEXT,

  -- Fitness
  training_time TEXT,
  step_tracker BOOLEAN,
  daily_steps TEXT,
  family_support TEXT,
  smoking BOOLEAN,

  -- Health & Sleep
  bowel_per_week TEXT,
  bowel_quality TEXT,
  sleepy_after_carbs BOOLEAN,
  sleep_difficulty BOOLEAN,
  sleep_disturbances BOOLEAN,
  sleep_hours TEXT,
  night_awakenings TEXT,
  wake_difficulty BOOLEAN,
  alarm_dependency TEXT,
  morning_fatigue TEXT,
  headache_frequency TEXT,

  -- Mental Health
  stress_response TEXT,
  stress_management TEXT,
  depression TEXT,
  mental_health_rating TEXT,
  concentration INTEGER CHECK (concentration BETWEEN 1 AND 10),
  anxiety INTEGER CHECK (anxiety BETWEEN 1 AND 10),

  -- Supplements & Markers
  supplements TEXT,
  sex_drive TEXT,
  sugar_cravings INTEGER CHECK (sugar_cravings BETWEEN 1 AND 10),
  energy_levels INTEGER CHECK (energy_levels BETWEEN 1 AND 10),

  -- Medical
  medications TEXT,
  injuries TEXT,
  heart_condition BOOLEAN DEFAULT false,
  chest_pain BOOLEAN DEFAULT false,
  diabetes BOOLEAN DEFAULT false,
  epilepsy BOOLEAN DEFAULT false,
  asthma BOOLEAN DEFAULT false,
  musculoskeletal BOOLEAN DEFAULT false,
  bp_medication BOOLEAN DEFAULT false,
  dizziness BOOLEAN DEFAULT false,
  growth_hypermobility BOOLEAN DEFAULT false,
  exercise_contraindications TEXT,
  exercise_limitations TEXT,

  -- Final
  obstacles TEXT,
  additional_info TEXT,
  allergies_acknowledged BOOLEAN DEFAULT false,
  liability_agreed BOOLEAN DEFAULT false,

  -- Computed health scores
  diet_score INTEGER CHECK (diet_score BETWEEN 0 AND 100),
  sleep_score INTEGER CHECK (sleep_score BETWEEN 0 AND 100),
  mental_score INTEGER CHECK (mental_score BETWEEN 0 AND 100),
  medical_flags INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_nf_email ON nutrition_forms(email);
CREATE INDEX IF NOT EXISTS idx_nf_created ON nutrition_forms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nf_name ON nutrition_forms(full_name);

ALTER TABLE nutrition_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_nf" ON nutrition_forms FOR SELECT USING (true);
CREATE POLICY "anon_insert_nf" ON nutrition_forms FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_nf" ON nutrition_forms FOR UPDATE USING (true);
GRANT ALL ON nutrition_forms TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

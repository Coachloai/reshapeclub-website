// Nutrition + Hormonal Assessment API
// Handles inserts (POST) and reads (GET) via direct Postgres.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const WEBHOOK_SECRET = Deno.env.get('NUTRITION_WEBHOOK_SECRET') || 'reshape-nutrition-2026';
const DB_URL = Deno.env.get('SUPABASE_DB_URL')!;

import { Pool } from 'https://deno.land/x/postgres@v0.19.3/mod.ts';

const pool = new Pool(DB_URL, 1, true);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method === 'GET') {
      const conn = await pool.connect();
      try {
        const result = await conn.queryObject`
          SELECT * FROM public.nutrition_forms ORDER BY created_at DESC`;
        return json(result.rows);
      } finally {
        conn.release();
      }
    }

    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    const body = await req.json().catch(() => ({}));
    if (body.secret !== WEBHOOK_SECRET) return json({ error: 'unauthorized' }, 401);
    if (!body.email || !body.full_name) return json({ error: 'email and full_name required' }, 400);

    const conn = await pool.connect();
    try {
      // If update_id provided, update existing record instead of inserting
      if (body.update_id) {
        await conn.queryObject`
          UPDATE public.nutrition_forms SET
            full_name = COALESCE(${s(body.full_name)}, full_name),
            phone = COALESCE(${s(body.phone)}, phone),
            gender = COALESCE(${s(body.gender)}, gender),
            date_of_birth = COALESCE(${d(body.date_of_birth)}, date_of_birth),
            diet_preference = COALESCE(${s(body.diet_preference)}, diet_preference),
            meals_per_day = COALESCE(${s(body.meals_per_day)}, meals_per_day),
            cooking_frequency = COALESCE(${s(body.cooking_frequency)}, cooking_frequency),
            meal_types = COALESCE(${s(body.meal_types)}, meal_types),
            sleep_hours = COALESCE(${s(body.sleep_hours)}, sleep_hours),
            night_awakenings = COALESCE(${s(body.night_awakenings)}, night_awakenings),
            morning_fatigue = COALESCE(${s(body.morning_fatigue)}, morning_fatigue),
            concentration = COALESCE(${i(body.concentration)}, concentration),
            anxiety = COALESCE(${i(body.anxiety)}, anxiety),
            energy_levels = COALESCE(${i(body.energy_levels)}, energy_levels),
            depression = COALESCE(${s(body.depression)}, depression),
            sugar_cravings = COALESCE(${i(body.sugar_cravings)}, sugar_cravings),
            heart_condition = ${b(body.heart_condition)},
            diabetes = ${b(body.diabetes)},
            asthma = ${b(body.asthma)},
            epilepsy = ${b(body.epilepsy)},
            musculoskeletal = ${b(body.musculoskeletal)},
            bp_medication = ${b(body.bp_medication)},
            chest_pain = ${b(body.chest_pain)},
            dizziness = ${b(body.dizziness)},
            training_time = COALESCE(${s(body.training_time)}, training_time),
            daily_steps = COALESCE(${s(body.daily_steps)}, daily_steps),
            alcohol = COALESCE(${s(body.alcohol)}, alcohol),
            stress_response = COALESCE(${s(body.stress_response)}, stress_response),
            sex_drive = COALESCE(${s(body.sex_drive)}, sex_drive),
            mental_health_rating = COALESCE(${s(body.mental_health_rating)}, mental_health_rating),
            current_size = COALESCE(${s(body.current_size)}, current_size),
            next_goal = COALESCE(${s(body.next_goal)}, next_goal),
            motivation = COALESCE(${s(body.motivation)}, motivation),
            breakfast = COALESCE(${s(body.breakfast)}, breakfast),
            lunch = COALESCE(${s(body.lunch)}, lunch),
            dinner = COALESCE(${s(body.dinner)}, dinner),
            snacking = COALESCE(${s(body.snacking)}, snacking),
            tea_coffee = COALESCE(${s(body.tea_coffee)}, tea_coffee),
            food_weaknesses = COALESCE(${s(body.food_weaknesses)}, food_weaknesses),
            past_diets = COALESCE(${s(body.past_diets)}, past_diets),
            eating_out_frequency = COALESCE(${s(body.eating_out_frequency)}, eating_out_frequency),
            eating_out_choices = COALESCE(${s(body.eating_out_choices)}, eating_out_choices),
            takeaways = COALESCE(${s(body.takeaways)}, takeaways),
            max_daily_meals = COALESCE(${s(body.max_daily_meals)}, max_daily_meals),
            dietary_challenges = COALESCE(${s(body.dietary_challenges)}, dietary_challenges),
            step_tracker = ${b(body.step_tracker)},
            family_support = COALESCE(${s(body.family_support)}, family_support),
            smoking = ${b(body.smoking)},
            bowel_per_week = COALESCE(${s(body.bowel_per_week)}, bowel_per_week),
            bowel_quality = COALESCE(${s(body.bowel_quality)}, bowel_quality),
            sleepy_after_carbs = ${b(body.sleepy_after_carbs)},
            sleep_difficulty = ${b(body.sleep_difficulty)},
            sleep_disturbances = ${b(body.sleep_disturbances)},
            wake_difficulty = ${b(body.wake_difficulty)},
            alarm_dependency = COALESCE(${s(body.alarm_dependency)}, alarm_dependency),
            headache_frequency = COALESCE(${s(body.headache_frequency)}, headache_frequency),
            stress_management = COALESCE(${s(body.stress_management)}, stress_management),
            supplements = COALESCE(${s(body.supplements)}, supplements),
            medications = COALESCE(${s(body.medications)}, medications),
            injuries = COALESCE(${s(body.injuries)}, injuries),
            growth_hypermobility = ${b(body.growth_hypermobility)},
            exercise_contraindications = COALESCE(${s(body.exercise_contraindications)}, exercise_contraindications),
            exercise_limitations = COALESCE(${s(body.exercise_limitations)}, exercise_limitations),
            obstacles = COALESCE(${s(body.obstacles)}, obstacles),
            additional_info = COALESCE(${s(body.additional_info)}, additional_info),
            allergies_acknowledged = ${b(body.allergies_acknowledged)},
            liability_agreed = ${b(body.liability_agreed)},
            emergency_contact_name = COALESCE(${s(body.emergency_contact_name)}, emergency_contact_name),
            emergency_contact_number = COALESCE(${s(body.emergency_contact_number)}, emergency_contact_number),
            h_insulin = COALESCE(${i(body.h_insulin)}, h_insulin),
            h_glucagon = COALESCE(${i(body.h_glucagon)}, h_glucagon),
            h_leptin = COALESCE(${i(body.h_leptin)}, h_leptin),
            h_adiponectin = COALESCE(${i(body.h_adiponectin)}, h_adiponectin),
            h_shbg = COALESCE(${i(body.h_shbg)}, h_shbg),
            h_cortisol = COALESCE(${i(body.h_cortisol)}, h_cortisol),
            h_adrenaline = COALESCE(${i(body.h_adrenaline)}, h_adrenaline),
            h_gh = COALESCE(${i(body.h_gh)}, h_gh),
            h_testosterone = COALESCE(${i(body.h_testosterone)}, h_testosterone),
            h_thyroid = COALESCE(${i(body.h_thyroid)}, h_thyroid),
            h_ghrelin = COALESCE(${i(body.h_ghrelin)}, h_ghrelin),
            h_estrogen = COALESCE(${i(body.h_estrogen)}, h_estrogen),
            h_progesterone = COALESCE(${i(body.h_progesterone)}, h_progesterone),
            h_aldosterone = COALESCE(${i(body.h_aldosterone)}, h_aldosterone),
            hormonal_answers = COALESCE(${body.hormonal_answers ? JSON.stringify(body.hormonal_answers) : null}, hormonal_answers),
            h_phase = COALESCE(${s(body.h_phase)}, h_phase),
            diet_score = COALESCE(${i(body.diet_score)}, diet_score),
            sleep_score = COALESCE(${i(body.sleep_score)}, sleep_score),
            mental_score = COALESCE(${i(body.mental_score)}, mental_score),
            medical_flags = COALESCE(${i(body.medical_flags)}, medical_flags)
          WHERE id = ${body.update_id}::uuid`;
        conn.release();
        return json({ ok: true, updated: true });
      }

      await conn.queryObject`
        INSERT INTO public.nutrition_forms (
          email, full_name, phone, gender, date_of_birth,
          diet_preference, meals_per_day, cooking_frequency, meal_types,
          sleep_hours, night_awakenings, morning_fatigue,
          concentration, anxiety, energy_levels, depression,
          sugar_cravings, heart_condition, diabetes, asthma, epilepsy,
          musculoskeletal, bp_medication, chest_pain, dizziness,
          training_time, daily_steps, alcohol,
          stress_response, sex_drive, mental_health_rating,
          current_size, next_goal, motivation,
          breakfast, lunch, dinner, snacking, tea_coffee,
          food_weaknesses, past_diets,
          eating_out_frequency, eating_out_choices, takeaways,
          max_daily_meals, dietary_challenges,
          step_tracker, family_support, smoking,
          bowel_per_week, bowel_quality,
          sleepy_after_carbs, sleep_difficulty, sleep_disturbances,
          wake_difficulty, alarm_dependency, headache_frequency,
          stress_management, supplements, medications, injuries,
          growth_hypermobility, exercise_contraindications, exercise_limitations,
          obstacles, additional_info,
          allergies_acknowledged, liability_agreed,
          emergency_contact_name, emergency_contact_number,
          h_insulin, h_glucagon, h_leptin, h_adiponectin, h_shbg,
          h_cortisol, h_adrenaline, h_gh, h_testosterone, h_thyroid,
          h_ghrelin, h_estrogen, h_progesterone, h_aldosterone,
          hormonal_answers, h_phase,
          diet_score, sleep_score, mental_score, medical_flags
        ) VALUES (
          ${s(body.email)}, ${s(body.full_name)}, ${s(body.phone)},
          ${s(body.gender)}, ${d(body.date_of_birth)},
          ${s(body.diet_preference)}, ${s(body.meals_per_day)},
          ${s(body.cooking_frequency)}, ${s(body.meal_types)},
          ${s(body.sleep_hours)}, ${s(body.night_awakenings)},
          ${s(body.morning_fatigue)},
          ${i(body.concentration)}, ${i(body.anxiety)},
          ${i(body.energy_levels)}, ${s(body.depression)},
          ${i(body.sugar_cravings)},
          ${b(body.heart_condition)}, ${b(body.diabetes)}, ${b(body.asthma)},
          ${b(body.epilepsy)}, ${b(body.musculoskeletal)}, ${b(body.bp_medication)},
          ${b(body.chest_pain)}, ${b(body.dizziness)},
          ${s(body.training_time)}, ${s(body.daily_steps)}, ${s(body.alcohol)},
          ${s(body.stress_response)}, ${s(body.sex_drive)}, ${s(body.mental_health_rating)},
          ${s(body.current_size)}, ${s(body.next_goal)}, ${s(body.motivation)},
          ${s(body.breakfast)}, ${s(body.lunch)}, ${s(body.dinner)},
          ${s(body.snacking)}, ${s(body.tea_coffee)},
          ${s(body.food_weaknesses)}, ${s(body.past_diets)},
          ${s(body.eating_out_frequency)}, ${s(body.eating_out_choices)},
          ${s(body.takeaways)}, ${s(body.max_daily_meals)},
          ${s(body.dietary_challenges)},
          ${b(body.step_tracker)}, ${s(body.family_support)}, ${b(body.smoking)},
          ${s(body.bowel_per_week)}, ${s(body.bowel_quality)},
          ${b(body.sleepy_after_carbs)}, ${b(body.sleep_difficulty)},
          ${b(body.sleep_disturbances)}, ${b(body.wake_difficulty)},
          ${s(body.alarm_dependency)}, ${s(body.headache_frequency)},
          ${s(body.stress_management)}, ${s(body.supplements)},
          ${s(body.medications)}, ${s(body.injuries)},
          ${b(body.growth_hypermobility)}, ${s(body.exercise_contraindications)},
          ${s(body.exercise_limitations)},
          ${s(body.obstacles)}, ${s(body.additional_info)},
          ${b(body.allergies_acknowledged)}, ${b(body.liability_agreed)},
          ${s(body.emergency_contact_name)}, ${s(body.emergency_contact_number)},
          ${i(body.h_insulin)}, ${i(body.h_glucagon)}, ${i(body.h_leptin)},
          ${i(body.h_adiponectin)}, ${i(body.h_shbg)},
          ${i(body.h_cortisol)}, ${i(body.h_adrenaline)}, ${i(body.h_gh)},
          ${i(body.h_testosterone)}, ${i(body.h_thyroid)},
          ${i(body.h_ghrelin)}, ${i(body.h_estrogen)},
          ${i(body.h_progesterone)}, ${i(body.h_aldosterone)},
          ${body.hormonal_answers ? JSON.stringify(body.hormonal_answers) : null},
          ${s(body.h_phase)},
          ${i(body.diet_score)}, ${i(body.sleep_score)},
          ${i(body.mental_score)}, ${i(body.medical_flags)}
        )
        ON CONFLICT (email) DO UPDATE SET
          full_name = COALESCE(EXCLUDED.full_name, nutrition_forms.full_name),
          phone = COALESCE(EXCLUDED.phone, nutrition_forms.phone),
          gender = COALESCE(EXCLUDED.gender, nutrition_forms.gender),
          date_of_birth = COALESCE(EXCLUDED.date_of_birth, nutrition_forms.date_of_birth),
          diet_preference = COALESCE(EXCLUDED.diet_preference, nutrition_forms.diet_preference),
          meals_per_day = COALESCE(EXCLUDED.meals_per_day, nutrition_forms.meals_per_day),
          cooking_frequency = COALESCE(EXCLUDED.cooking_frequency, nutrition_forms.cooking_frequency),
          meal_types = COALESCE(EXCLUDED.meal_types, nutrition_forms.meal_types),
          sleep_hours = COALESCE(EXCLUDED.sleep_hours, nutrition_forms.sleep_hours),
          night_awakenings = COALESCE(EXCLUDED.night_awakenings, nutrition_forms.night_awakenings),
          morning_fatigue = COALESCE(EXCLUDED.morning_fatigue, nutrition_forms.morning_fatigue),
          concentration = COALESCE(EXCLUDED.concentration, nutrition_forms.concentration),
          anxiety = COALESCE(EXCLUDED.anxiety, nutrition_forms.anxiety),
          energy_levels = COALESCE(EXCLUDED.energy_levels, nutrition_forms.energy_levels),
          depression = COALESCE(EXCLUDED.depression, nutrition_forms.depression),
          sugar_cravings = COALESCE(EXCLUDED.sugar_cravings, nutrition_forms.sugar_cravings),
          heart_condition = EXCLUDED.heart_condition,
          diabetes = EXCLUDED.diabetes,
          asthma = EXCLUDED.asthma,
          epilepsy = EXCLUDED.epilepsy,
          musculoskeletal = EXCLUDED.musculoskeletal,
          bp_medication = EXCLUDED.bp_medication,
          chest_pain = EXCLUDED.chest_pain,
          dizziness = EXCLUDED.dizziness,
          training_time = COALESCE(EXCLUDED.training_time, nutrition_forms.training_time),
          daily_steps = COALESCE(EXCLUDED.daily_steps, nutrition_forms.daily_steps),
          alcohol = COALESCE(EXCLUDED.alcohol, nutrition_forms.alcohol),
          stress_response = COALESCE(EXCLUDED.stress_response, nutrition_forms.stress_response),
          sex_drive = COALESCE(EXCLUDED.sex_drive, nutrition_forms.sex_drive),
          mental_health_rating = COALESCE(EXCLUDED.mental_health_rating, nutrition_forms.mental_health_rating),
          current_size = COALESCE(EXCLUDED.current_size, nutrition_forms.current_size),
          next_goal = COALESCE(EXCLUDED.next_goal, nutrition_forms.next_goal),
          motivation = COALESCE(EXCLUDED.motivation, nutrition_forms.motivation),
          breakfast = COALESCE(EXCLUDED.breakfast, nutrition_forms.breakfast),
          lunch = COALESCE(EXCLUDED.lunch, nutrition_forms.lunch),
          dinner = COALESCE(EXCLUDED.dinner, nutrition_forms.dinner),
          snacking = COALESCE(EXCLUDED.snacking, nutrition_forms.snacking),
          tea_coffee = COALESCE(EXCLUDED.tea_coffee, nutrition_forms.tea_coffee),
          food_weaknesses = COALESCE(EXCLUDED.food_weaknesses, nutrition_forms.food_weaknesses),
          past_diets = COALESCE(EXCLUDED.past_diets, nutrition_forms.past_diets),
          eating_out_frequency = COALESCE(EXCLUDED.eating_out_frequency, nutrition_forms.eating_out_frequency),
          eating_out_choices = COALESCE(EXCLUDED.eating_out_choices, nutrition_forms.eating_out_choices),
          takeaways = COALESCE(EXCLUDED.takeaways, nutrition_forms.takeaways),
          max_daily_meals = COALESCE(EXCLUDED.max_daily_meals, nutrition_forms.max_daily_meals),
          dietary_challenges = COALESCE(EXCLUDED.dietary_challenges, nutrition_forms.dietary_challenges),
          step_tracker = EXCLUDED.step_tracker,
          family_support = COALESCE(EXCLUDED.family_support, nutrition_forms.family_support),
          smoking = EXCLUDED.smoking,
          bowel_per_week = COALESCE(EXCLUDED.bowel_per_week, nutrition_forms.bowel_per_week),
          bowel_quality = COALESCE(EXCLUDED.bowel_quality, nutrition_forms.bowel_quality),
          sleepy_after_carbs = EXCLUDED.sleepy_after_carbs,
          sleep_difficulty = EXCLUDED.sleep_difficulty,
          sleep_disturbances = EXCLUDED.sleep_disturbances,
          wake_difficulty = EXCLUDED.wake_difficulty,
          alarm_dependency = COALESCE(EXCLUDED.alarm_dependency, nutrition_forms.alarm_dependency),
          headache_frequency = COALESCE(EXCLUDED.headache_frequency, nutrition_forms.headache_frequency),
          stress_management = COALESCE(EXCLUDED.stress_management, nutrition_forms.stress_management),
          supplements = COALESCE(EXCLUDED.supplements, nutrition_forms.supplements),
          medications = COALESCE(EXCLUDED.medications, nutrition_forms.medications),
          injuries = COALESCE(EXCLUDED.injuries, nutrition_forms.injuries),
          growth_hypermobility = EXCLUDED.growth_hypermobility,
          exercise_contraindications = COALESCE(EXCLUDED.exercise_contraindications, nutrition_forms.exercise_contraindications),
          exercise_limitations = COALESCE(EXCLUDED.exercise_limitations, nutrition_forms.exercise_limitations),
          obstacles = COALESCE(EXCLUDED.obstacles, nutrition_forms.obstacles),
          additional_info = COALESCE(EXCLUDED.additional_info, nutrition_forms.additional_info),
          allergies_acknowledged = EXCLUDED.allergies_acknowledged,
          liability_agreed = EXCLUDED.liability_agreed,
          emergency_contact_name = COALESCE(EXCLUDED.emergency_contact_name, nutrition_forms.emergency_contact_name),
          emergency_contact_number = COALESCE(EXCLUDED.emergency_contact_number, nutrition_forms.emergency_contact_number),
          h_insulin = COALESCE(EXCLUDED.h_insulin, nutrition_forms.h_insulin),
          h_glucagon = COALESCE(EXCLUDED.h_glucagon, nutrition_forms.h_glucagon),
          h_leptin = COALESCE(EXCLUDED.h_leptin, nutrition_forms.h_leptin),
          h_adiponectin = COALESCE(EXCLUDED.h_adiponectin, nutrition_forms.h_adiponectin),
          h_shbg = COALESCE(EXCLUDED.h_shbg, nutrition_forms.h_shbg),
          h_cortisol = COALESCE(EXCLUDED.h_cortisol, nutrition_forms.h_cortisol),
          h_adrenaline = COALESCE(EXCLUDED.h_adrenaline, nutrition_forms.h_adrenaline),
          h_gh = COALESCE(EXCLUDED.h_gh, nutrition_forms.h_gh),
          h_testosterone = COALESCE(EXCLUDED.h_testosterone, nutrition_forms.h_testosterone),
          h_thyroid = COALESCE(EXCLUDED.h_thyroid, nutrition_forms.h_thyroid),
          h_ghrelin = COALESCE(EXCLUDED.h_ghrelin, nutrition_forms.h_ghrelin),
          h_estrogen = COALESCE(EXCLUDED.h_estrogen, nutrition_forms.h_estrogen),
          h_progesterone = COALESCE(EXCLUDED.h_progesterone, nutrition_forms.h_progesterone),
          h_aldosterone = COALESCE(EXCLUDED.h_aldosterone, nutrition_forms.h_aldosterone),
          hormonal_answers = COALESCE(EXCLUDED.hormonal_answers, nutrition_forms.hormonal_answers),
          h_phase = COALESCE(EXCLUDED.h_phase, nutrition_forms.h_phase),
          diet_score = COALESCE(EXCLUDED.diet_score, nutrition_forms.diet_score),
          sleep_score = COALESCE(EXCLUDED.sleep_score, nutrition_forms.sleep_score),
          mental_score = COALESCE(EXCLUDED.mental_score, nutrition_forms.mental_score),
          medical_flags = COALESCE(EXCLUDED.medical_flags, nutrition_forms.medical_flags)`;
    } finally {
      conn.release();
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const r = String(v).trim();
  return r || null;
}
function b(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return /^(yes|true|1|got it|agree)$/i.test(v.trim());
  return false;
}
function i(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}
function d(v: unknown): string | null {
  if (!v) return null;
  const str = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

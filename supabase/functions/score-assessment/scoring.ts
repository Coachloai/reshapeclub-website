// ReShape Hormonal Assessment — pure scoring logic.
// No IO. Imported by index.ts (production) and scoring_test.ts (Deno tests).

export type Hormone =
  | "cortisol"
  | "ghrelin"
  | "estrogen"
  | "progesterone"
  | "testosterone"
  | "insulin"
  | "leptin";

export type Weights = Partial<Record<Hormone, number>>;

export const HORMONES: readonly Hormone[] = [
  "cortisol",
  "ghrelin",
  "estrogen",
  "progesterone",
  "testosterone",
  "insulin",
  "leptin",
];

// Single source of truth for the 14-question weight table.
// Keys map to question_id; nested keys map to canonical answer_value.
export const WEIGHTS: Record<string, Record<string, Weights>> = {
  Q1: {
    postpartum:        { progesterone: 1, estrogen: 1 },
    cycling_regularly: {},
    perimenopausal:    { estrogen: 2, progesterone: 2 },
    menopausal:        { estrogen: 3, progesterone: 2, testosterone: 2 },
    on_hbc:            {},
  },
  Q2: {
    regular:        {},
    heavy_painful:  { estrogen: 2, progesterone: 1 },
    light_skipping: { estrogen: 2, progesterone: 1 },
    irregular:      { estrogen: 1, progesterone: 2 },
    na:             {},
  },
  Q3: {
    belly: { cortisol: 3, insulin: 2 },
    hips:  { estrogen: 2 },
    even:  { insulin: 1 },
    upper: { cortisol: 1, insulin: 1 },
  },
  Q4: {
    severe:   { progesterone: 3, estrogen: 1 },
    moderate: { progesterone: 2 },
    mild:     { progesterone: 1 },
    none:     {},
    na:       {},
  },
  Q5: {
    sleep_through:    {},
    two_to_four_am:   { cortisol: 3, ghrelin: 1 },
    four_to_six_am:   { cortisol: 2 },
    cant_fall_asleep: { progesterone: 2, cortisol: 1 },
  },
  Q6: {
    high_chronic: { cortisol: 3, ghrelin: 1 },
    moderate:     { cortisol: 2 },
    variable:     { cortisol: 1 },
    low:          {},
  },
  Q7: {
    hard_crash:       { insulin: 3 },
    slight_dip:       { insulin: 1 },
    steady:           {},
    tired_regardless: { insulin: 1, leptin: 1 },
  },
  Q8: {
    constant_never_full: { leptin: 3 },
    sudden_surges:       { ghrelin: 3 },
    predictable:         {},
    rarely_hungry:       { leptin: 1 },
  },
  Q9: {
    afternoon:     { cortisol: 2, insulin: 1 },
    evening:       { insulin: 2, cortisol: 1 },
    morning:       { cortisol: 1 },
    around_period: { estrogen: 2 },
    none:          {},
  },
  Q10: {
    significantly_lower: { testosterone: 3, estrogen: 1 },
    some_change:         { testosterone: 1 },
    same:                {},
    varies_with_cycle:   { estrogen: 1 },
  },
  Q11: {
    real_changes:         {},
    slow_progress:        { testosterone: 1 },
    almost_nothing:       { testosterone: 2, insulin: 2 },
    cant_stay_consistent: { cortisol: 1 },
  },
  Q12: {
    never_lost_what_i_want: { leptin: 1, insulin: 1 },
    lose_plateau:           { leptin: 3 },
    lose_regain:            { leptin: 3, insulin: 1 },
    recent_issue:           { cortisol: 1, estrogen: 1 },
  },
  // Q13 multi-select: recorded for the nutritionist, not scored.
  Q13: {
    calorie_counting: {},
    keto: {},
    intermittent_fasting: {},
    personal_trainer: {},
    group_fitness: {},
    noom_ww: {},
    functional_med: {},
    glp1: {},
    coaching: {},
    nothing: {},
  },
  // Q14: emotional anchor for the result page, not scored.
  Q14: {
    lose_fat_no_crash: {},
    energy_back: {},
    feel_like_myself: {},
    build_muscle: {},
    sustainable_habits: {},
  },
};

const REQUIRED_QUESTIONS = [
  "Q1", "Q2", "Q3", "Q4", "Q5",
  "Q6", "Q7", "Q8", "Q9", "Q10",
  "Q11", "Q12", "Q14",
];

export type ArchetypePrimary =
  | "stress_driven_plateau"
  | "hormonal_shift"
  | "metabolic_resistance"
  | "compound_pattern";

export type ArchetypeSecondary =
  | "stress_driven_plateau"
  | "hormonal_shift"
  | "metabolic_resistance"
  | null;

export type ScoringResult = {
  primary_archetype: ArchetypePrimary;
  secondary_archetype: ArchetypeSecondary;
  hormone_scores: Record<Hormone, number>;
  cluster_scores: { stress: number; hormonal_shift: number; metabolic: number };
  flags: string[];
};

export type ScoringError = {
  error: "incomplete" | "invalid";
  missing?: string[];
  invalid?: string[];
};

export function isScoringError(r: ScoringResult | ScoringError): r is ScoringError {
  return (r as ScoringError).error !== undefined;
}

export function validateAnswers(answers: Record<string, string>): ScoringError | null {
  const invalid: string[] = [];

  for (const [qid, val] of Object.entries(answers)) {
    if (!(qid in WEIGHTS)) { invalid.push(`unknown question ${qid}`); continue; }
    if (qid === "Q13") {
      const keys = val.split(",").map((s) => s.trim()).filter(Boolean);
      for (const k of keys) {
        if (!(k in WEIGHTS.Q13)) invalid.push(`Q13 unknown answer ${k}`);
      }
    } else {
      if (!(val in WEIGHTS[qid])) invalid.push(`${qid} unknown answer ${val}`);
    }
  }

  if (invalid.length) return { error: "invalid", invalid };

  const missing = REQUIRED_QUESTIONS.filter((q) => !(q in answers));
  if (missing.length) return { error: "incomplete", missing };

  return null;
}

export function scoreAssessment(
  answers: Record<string, string>,
): ScoringResult | ScoringError {
  const validation = validateAnswers(answers);
  if (validation) return validation;

  const scores: Record<Hormone, number> = {
    cortisol: 0, ghrelin: 0, estrogen: 0, progesterone: 0,
    testosterone: 0, insulin: 0, leptin: 0,
  };
  const flags: string[] = [];

  const onHbc       = answers.Q1 === "on_hbc";
  const isMenopausal = answers.Q1 === "menopausal";
  const isPostpartum = answers.Q1 === "postpartum";
  if (onHbc)       flags.push("on_hormonal_birth_control");
  if (isMenopausal) flags.push("menopausal");
  if (isPostpartum) flags.push("postpartum");

  for (const [qid, val] of Object.entries(answers)) {
    if (qid === "Q13" || qid === "Q14") continue;
    const weights = WEIGHTS[qid]?.[val] || {};
    const multiplier = (qid === "Q2" && onHbc) ? 0.5 : 1;
    for (const [h, w] of Object.entries(weights) as [Hormone, number][]) {
      scores[h] += w * multiplier;
    }
  }

  for (const h of HORMONES) {
    scores[h] = Math.min(10, Math.max(0, scores[h]));
  }

  const stress         = (scores.cortisol + scores.ghrelin) / 2;
  const hormonal_shift = (scores.estrogen + scores.progesterone + scores.testosterone) / 3;
  const metabolic      = (scores.insulin + scores.leptin) / 2;
  const clusters = { stress, hormonal_shift, metabolic };

  const sorted = (Object.entries(clusters) as [keyof typeof clusters, number][])
    .sort((a, b) => b[1] - a[1]);
  const [topKey, topVal]       = sorted[0];
  const [secondKey, secondVal] = sorted[1];
  const minVal                 = sorted[2][1];

  let primary: ArchetypePrimary;
  let secondary: ArchetypeSecondary = null;

  // Compound when (max - min) / max < 0.20 across all three clusters.
  if (topVal > 0 && (topVal - minVal) / topVal < 0.20) {
    primary = "compound_pattern";
  } else {
    const map: Record<keyof typeof clusters, Exclude<ArchetypePrimary, "compound_pattern">> = {
      stress: "stress_driven_plateau",
      hormonal_shift: "hormonal_shift",
      metabolic: "metabolic_resistance",
    };
    primary = map[topKey];
    if (topVal > 0 && (topVal - secondVal) / topVal < 0.30) {
      secondary = map[secondKey];
    }
  }

  return {
    primary_archetype: primary,
    secondary_archetype: secondary,
    hormone_scores: scores,
    cluster_scores: {
      stress: round1(stress),
      hormonal_shift: round1(hormonal_shift),
      metabolic: round1(metabolic),
    },
    flags,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

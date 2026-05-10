// Unit tests for the scoring algorithm.
// Run with:  deno test supabase/functions/score-assessment/scoring_test.ts
//
// Covers the six cases from Section 5 of the build spec.

import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isScoringError, scoreAssessment } from "./scoring.ts";

const completeBaseline: Record<string, string> = {
  Q1: "cycling_regularly",
  Q2: "regular",
  Q3: "even",
  Q4: "none",
  Q5: "sleep_through",
  Q6: "low",
  Q7: "steady",
  Q8: "predictable",
  Q9: "none",
  Q10: "same",
  Q11: "real_changes",
  Q12: "never_lost_what_i_want",
  Q14: "sustainable_habits",
};

Deno.test("stress-driven user → stress_driven_plateau", () => {
  const r = scoreAssessment({
    ...completeBaseline,
    Q3: "belly",            // cortisol+3, insulin+2
    Q5: "two_to_four_am",   // cortisol+3, ghrelin+1
    Q6: "high_chronic",     // cortisol+3, ghrelin+1
    Q9: "afternoon",        // cortisol+2, insulin+1
  });
  assert(!isScoringError(r));
  if (isScoringError(r)) return;
  assertEquals(r.primary_archetype, "stress_driven_plateau");
  // Cortisol should be capped at 10 (raw 11).
  assertEquals(r.hormone_scores.cortisol, 10);
  assert(r.cluster_scores.stress > r.cluster_scores.hormonal_shift);
  assert(r.cluster_scores.stress > r.cluster_scores.metabolic);
});

Deno.test("menopausal user → hormonal_shift + flag", () => {
  const r = scoreAssessment({
    ...completeBaseline,
    Q1: "menopausal",          // estrogen+3, progesterone+2, testosterone+2
    Q2: "na",
    Q3: "hips",                // estrogen+2
    Q4: "na",
    Q10: "significantly_lower", // testosterone+3, estrogen+1
    Q11: "slow_progress",       // testosterone+1
    Q12: "recent_issue",        // cortisol+1, estrogen+1
  });
  assert(!isScoringError(r));
  if (isScoringError(r)) return;
  assertEquals(r.primary_archetype, "hormonal_shift");
  assert(r.flags.includes("menopausal"));
});

Deno.test("metabolic user → metabolic_resistance", () => {
  const r = scoreAssessment({
    ...completeBaseline,
    Q7: "hard_crash",          // insulin+3
    Q8: "constant_never_full",  // leptin+3
    Q11: "almost_nothing",      // testosterone+2, insulin+2
    Q12: "lose_regain",         // leptin+3, insulin+1
  });
  assert(!isScoringError(r));
  if (isScoringError(r)) return;
  assertEquals(r.primary_archetype, "metabolic_resistance");
  assert(r.cluster_scores.metabolic > r.cluster_scores.stress);
  assert(r.cluster_scores.metabolic > r.cluster_scores.hormonal_shift);
});

Deno.test("compound pattern → all three clusters within 20%", () => {
  const r = scoreAssessment({
    Q1: "postpartum",          // progesterone+1, estrogen+1
    Q2: "irregular",           // estrogen+1, progesterone+2
    Q3: "even",                // insulin+1
    Q4: "moderate",            // progesterone+2
    Q5: "four_to_six_am",      // cortisol+2
    Q6: "moderate",            // cortisol+2
    Q7: "tired_regardless",    // insulin+1, leptin+1
    Q8: "rarely_hungry",       // leptin+1
    Q9: "morning",             // cortisol+1
    Q10: "some_change",         // testosterone+1
    Q11: "cant_stay_consistent", // cortisol+1
    Q12: "never_lost_what_i_want", // leptin+1, insulin+1
    Q14: "feel_like_myself",
  });
  assert(!isScoringError(r));
  if (isScoringError(r)) return;
  assertEquals(r.primary_archetype, "compound_pattern");
  assertEquals(r.secondary_archetype, null);
  // Confirm the spread really is within 20%.
  const vals = Object.values(r.cluster_scores);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  assert((max - min) / max < 0.20, `spread ${(max - min) / max}`);
});

Deno.test("on_hbc halves Q2 contribution + sets flag", () => {
  const base: Record<string, string> = {
    ...completeBaseline,
    Q2: "heavy_painful", // would normally add estrogen+2, progesterone+1
  };
  const without = scoreAssessment(base);
  const withHbc = scoreAssessment({ ...base, Q1: "on_hbc" });
  assert(!isScoringError(without));
  assert(!isScoringError(withHbc));
  if (isScoringError(without) || isScoringError(withHbc)) return;

  // Q1=on_hbc itself contributes nothing, so the only delta is Q2 halved.
  assertEquals(without.hormone_scores.estrogen - withHbc.hormone_scores.estrogen, 1);
  assertEquals(without.hormone_scores.progesterone - withHbc.hormone_scores.progesterone, 0.5);
  assert(withHbc.flags.includes("on_hormonal_birth_control"));
});

Deno.test("incomplete submission → 400-style error", () => {
  const partial: Record<string, string> = {
    Q1: "cycling_regularly",
    Q2: "regular",
    Q3: "even",
    Q4: "none",
    Q5: "sleep_through",
    Q6: "low",
    Q7: "steady",
    // Q8–Q14 missing.
  };
  const r = scoreAssessment(partial);
  assert(isScoringError(r));
  if (!isScoringError(r)) return;
  assertEquals(r.error, "incomplete");
  assertExists(r.missing);
  assert(r.missing!.includes("Q14"));
});

Deno.test("unknown answer values are rejected", () => {
  const r = scoreAssessment({
    ...completeBaseline,
    Q3: "diagonal", // not a valid answer
  });
  assert(isScoringError(r));
  if (!isScoringError(r)) return;
  assertEquals(r.error, "invalid");
  assert((r.invalid || []).some((s) => s.includes("Q3")));
});

Deno.test("postpartum flag set", () => {
  const r = scoreAssessment({
    ...completeBaseline,
    Q1: "postpartum",
    Q2: "irregular",
  });
  assert(!isScoringError(r));
  if (isScoringError(r)) return;
  assert(r.flags.includes("postpartum"));
});

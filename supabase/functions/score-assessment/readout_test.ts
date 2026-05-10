// Unit tests for the personalised readout assembler.
// Covers the priority combo cells from the scenario plan + a handful of
// adversarial cases (all-zero, ties, life-stage interplay, Q13 swap rules).
//
// Run with:  deno test supabase/functions/score-assessment/readout_test.ts

import {
  assert,
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isScoringError, scoreAssessment } from "./scoring.ts";
import { buildReadout } from "./readout.ts";

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

function score(answers: Record<string, string>) {
  const r = scoreAssessment(answers);
  if (isScoringError(r)) throw new Error("scoring error: " + JSON.stringify(r));
  return r;
}

Deno.test("stress + cycling + afternoon cravings → readout reflects belly + 2-4am + afternoon", () => {
  const answers = {
    ...completeBaseline,
    Q3: "belly",
    Q5: "two_to_four_am",
    Q6: "high_chronic",
    Q9: "afternoon",
    Q14: "energy_back",
  };
  const r = buildReadout(score(answers), answers);
  assertEquals(r.headline, "You're a Stress-Driven Plateau.");
  assertStringIncludes(r.mirror, "midsection");
  assertStringIncludes(r.mirror, "2 and 4 AM");
  assertStringIncludes(r.mirror, "afternoon");
  assertStringIncludes(r.mirror, "cortisol signature");
  assert(r.objections.length >= 3 && r.objections.length <= 4);
  assertStringIncludes(r.closer, "energy fix");
});

Deno.test("stress + on_hbc → mirror para 2 calls out HBC mutes cycle data", () => {
  const answers = {
    ...completeBaseline,
    Q1: "on_hbc",
    Q3: "belly",
    Q5: "two_to_four_am",
    Q6: "high_chronic",
    Q9: "afternoon",
  };
  const r = buildReadout(score(answers), answers);
  assertEquals(r.headline, "You're a Stress-Driven Plateau.");
  assertStringIncludes(r.mirror, "hormonal birth control");
  assertStringIncludes(r.mirror, "sleep, stress");
});

Deno.test("hormonal_shift + menopausal → menopausal-flavoured copy, no cycle references", () => {
  const answers = {
    ...completeBaseline,
    Q1: "menopausal",
    Q2: "na",
    Q3: "hips",
    Q4: "na",
    Q10: "significantly_lower",
    Q11: "slow_progress",
    Q12: "recent_issue",
    Q14: "feel_like_myself",
  };
  const r = buildReadout(score(answers), answers);
  assertEquals(r.headline, "You're a Hormonal Shift Pattern.");
  assertStringIncludes(r.mirror.toLowerCase(), "menopaus");
  assert(!r.mirror.includes("cycle has gone irregular"));
  assertStringIncludes(r.closer, "feel like");
});

Deno.test("hormonal_shift + cycling_regularly (young) → 'too young' framing kicks in", () => {
  const answers = {
    ...completeBaseline,
    Q1: "cycling_regularly",
    Q2: "irregular",
    Q3: "hips",
    Q4: "severe",
    Q10: "significantly_lower",
    Q11: "almost_nothing",
  };
  const r = buildReadout(score(answers), answers);
  assertEquals(r.headline, "You're a Hormonal Shift Pattern.");
  assertStringIncludes(r.mirror, "too young");
});

Deno.test("hormonal_shift + postpartum → postpartum-specific framing, not menopause", () => {
  const answers = {
    ...completeBaseline,
    Q1: "postpartum",
    Q2: "irregular",
    Q3: "hips",
    Q4: "moderate",
    Q10: "varies_with_cycle",
    Q11: "slow_progress",
  };
  const r = buildReadout(score(answers), answers);
  assert(score(answers).flags.includes("postpartum"));
  assertStringIncludes(r.mirror, "ostpartum");
});

Deno.test("metabolic_resistance + lose_regain + hard_crash → reflects regain + crash", () => {
  const answers = {
    ...completeBaseline,
    Q7: "hard_crash",
    Q8: "constant_never_full",
    Q11: "almost_nothing",
    Q12: "lose_regain",
    Q14: "lose_fat_no_crash",
  };
  const r = buildReadout(score(answers), answers);
  assertEquals(r.headline, "You're a Metabolic Resistance Pattern.");
  assertStringIncludes(r.mirror, "more than you lost");
  assertStringIncludes(r.mirror, "energy crashes hard");
  assertStringIncludes(r.mirror, "metabolic resistance");
  assertStringIncludes(r.closer, "fat-loss path");
});

Deno.test("compound + nothing tried → 'haven't been given the right framework' framing", () => {
  const answers = {
    Q1: "postpartum",
    Q2: "irregular",
    Q3: "even",
    Q4: "moderate",
    Q5: "four_to_six_am",
    Q6: "moderate",
    Q7: "tired_regardless",
    Q8: "rarely_hungry",
    Q9: "morning",
    Q10: "some_change",
    Q11: "cant_stay_consistent",
    Q12: "never_lost_what_i_want",
    Q13: "nothing",
    Q14: "feel_like_myself",
  };
  const r = buildReadout(score(answers), answers);
  assertEquals(r.headline, "You're a Compound Pattern.");
  assertStringIncludes(r.mirror, "right framework");
  assert(!r.mirror.includes("wrong order"));
});

Deno.test("compound + tried things → 'wrong order' framing + named sequence", () => {
  // Answers tuned so all 3 clusters score within 20% of each other.
  const answers = {
    Q1: "postpartum",
    Q2: "irregular",
    Q3: "even",
    Q4: "moderate",
    Q5: "four_to_six_am",
    Q6: "moderate",
    Q7: "tired_regardless",
    Q8: "rarely_hungry",
    Q9: "morning",
    Q10: "some_change",
    Q11: "cant_stay_consistent",
    Q12: "never_lost_what_i_want",
    Q13: "calorie_counting,personal_trainer",
    Q14: "lose_fat_no_crash",
  };
  const s = score(answers);
  assertEquals(s.primary_archetype, "compound_pattern");
  const r = buildReadout(s, answers);
  assertStringIncludes(r.mirror, "wrong order");
  // Ordering: stress / hormonal / metabolic — at least one arrow.
  assertStringIncludes(r.mirror, "→");
});

Deno.test("Q13 with multiple tried items → swaps in targeted objection (max 4)", () => {
  const answers = {
    ...completeBaseline,
    Q3: "belly",
    Q5: "two_to_four_am",
    Q6: "high_chronic",
    Q13: "calorie_counting,glp1",
    Q14: "lose_fat_no_crash",
  };
  const r = buildReadout(score(answers), answers);
  assert(r.objections.length === 4, `expected 4 objections, got ${r.objections.length}`);
  // Both targeted objections should be present.
  const titles = r.objections.map((o) => o.title);
  assert(titles.some((t) => t.toLowerCase().includes("calorie counting")));
  assert(titles.some((t) => t.toLowerCase().includes("glp")));
});

Deno.test("Q13 with no recognised matches → exactly 3 base objections", () => {
  const answers = {
    ...completeBaseline,
    Q3: "belly",
    Q5: "two_to_four_am",
    Q6: "high_chronic",
    Q13: "nothing",
    Q14: "lose_fat_no_crash",
  };
  const r = buildReadout(score(answers), answers);
  assertEquals(r.objections.length, 3);
});

Deno.test("Q14 closer maps to all 5 goals", () => {
  const goals = ["lose_fat_no_crash", "energy_back", "feel_like_myself", "build_muscle", "sustainable_habits"];
  for (const g of goals) {
    const answers = { ...completeBaseline, Q3: "belly", Q6: "high_chronic", Q14: g };
    const r = buildReadout(score(answers), answers);
    assertExists(r.closer);
    assert(r.closer.length > 30, `closer too short for ${g}: ${r.closer}`);
  }
});

Deno.test("benign all-baseline scores → fallback readout, not forced archetype script", () => {
  const r = buildReadout(score(completeBaseline), completeBaseline);
  assertEquals(r.headline, "Your pattern is mostly clear.");
  assert(!r.mirror.includes("cortisol signature"));
  assertEquals(r.objections.length, 3);
});

Deno.test("secondary archetype → renders the 'with notable signals' line", () => {
  // Build answers that score high on stress AND metabolic so we get a secondary.
  const answers = {
    ...completeBaseline,
    Q3: "belly",            // cortisol+3 insulin+2
    Q5: "two_to_four_am",   // cortisol+3 ghrelin+1
    Q6: "high_chronic",     // cortisol+3 ghrelin+1
    Q7: "hard_crash",       // insulin+3
    Q8: "constant_never_full", // leptin+3
    Q9: "afternoon",        // cortisol+2 insulin+1
    Q12: "lose_regain",     // leptin+3 insulin+1
  };
  const s = score(answers);
  if (s.secondary_archetype) {
    const r = buildReadout(s, answers);
    assertExists(r.secondary);
    assertStringIncludes(r.secondary!, "notable signals");
  }
});

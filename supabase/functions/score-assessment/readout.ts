// ReShape Hormonal Assessment — personalised readout assembler.
//
// Pure function: takes the scoring result + raw answers and returns the
// per-user narrative shown on the result page (and persisted in the DB).
//
// No IO, no fetches, no LLM. Hybrid template: per-archetype skeleton plus
// conditional inserts driven by life-stage flag, top-hormone signature,
// Q13 (things tried), Q14 (goal). See plan file for the full scenario map.

import type { Hormone, ScoringResult } from "./scoring.ts";

export type Objection = { title: string; body: string };

export type Readout = {
  headline: string;
  secondary: string | null;
  mirror: string;       // HTML — 2 paragraphs
  objections: Objection[]; // 3 or 4
  closer: string;       // 1 sentence
};

const ARCHETYPE_LABEL: Record<string, string> = {
  stress_driven_plateau: "Stress-Driven Plateau",
  hormonal_shift:        "Hormonal Shift Pattern",
  metabolic_resistance:  "Metabolic Resistance Pattern",
  compound_pattern:      "Compound Pattern",
};

// ── Public entry point ────────────────────────────────────────────────
export function buildReadout(
  score: ScoringResult,
  answers: Record<string, string>,
): Readout {
  // Catch the all-zero / mostly-benign case before forcing an archetype script.
  if (isBenign(score)) {
    return benignReadout(answers);
  }

  const primary   = score.primary_archetype;
  const headline  = `You're a ${ARCHETYPE_LABEL[primary]}.`;
  const secondary = secondaryLine(score);
  const mirror    = buildMirror(score, answers);
  const objections = buildObjections(score, answers);
  const closer    = buildCloser(answers);

  return { headline, secondary, mirror, objections, closer };
}

// ── Benign / low-signal fallback ─────────────────────────────────────
function isBenign(score: ScoringResult): boolean {
  const top = Math.max(
    score.cluster_scores.stress,
    score.cluster_scores.hormonal_shift,
    score.cluster_scores.metabolic,
  );
  return top < 1.6;
}

function benignReadout(answers: Record<string, string>): Readout {
  return {
    headline: "Your pattern is mostly clear.",
    secondary: null,
    mirror:
      "<p>Based on what you shared, none of the major hormone-driven patterns " +
      "are dialled up for you right now. Your sleep, stress, blood sugar and " +
      "cycle signals all read in a relatively quiet range.</p>" +
      "<p>That doesn't mean you have nothing to work on — it means a generic " +
      "pattern script wouldn't be honest. On a strategy call we'd look at the " +
      "small frictions that are actually slowing your progress, rather than " +
      "force-fitting a hormonal narrative.</p>",
    objections: [
      {
        title: "If you're plateauing, it's tactical not hormonal",
        body: "When the hormone signals are quiet, plateau usually comes from training stimulus, protein intake, or sleep consistency — not endocrine dysfunction.",
      },
      {
        title: "You probably don't need bloodwork",
        body: "We only recommend a panel when the signal map points there. Yours doesn't, so we'd save you the spend.",
      },
      {
        title: "Generic plans still won't get you there",
        body: "A clear screen doesn't mean a clear plan. The 45-minute call is where we'd dial in the small things that actually move the needle for you.",
      },
    ],
    closer: buildCloser(answers),
  };
}

// ── Secondary archetype line ─────────────────────────────────────────
function secondaryLine(score: ScoringResult): string | null {
  const sec = score.secondary_archetype;
  if (!sec || sec === score.primary_archetype) return null;
  return `With notable signals from the ${ARCHETYPE_LABEL[sec]}.`;
}

// ── Mirror narrative ─────────────────────────────────────────────────
function buildMirror(
  score: ScoringResult,
  answers: Record<string, string>,
): string {
  switch (score.primary_archetype) {
    case "stress_driven_plateau":
      return mirrorStress(score, answers);
    case "hormonal_shift":
      return mirrorHormonal(score, answers);
    case "metabolic_resistance":
      return mirrorMetabolic(score, answers);
    case "compound_pattern":
      return mirrorCompound(score, answers);
  }
}

// Helper: stitch 1–3 phrases into a natural sentence.
function joinPhrases(phrases: string[]): string {
  const top = phrases.slice(0, 3);
  if (top.length === 0) return "";
  if (top.length === 1) return top[0];
  if (top.length === 2) return `${top[0]} and ${top[1]}`;
  return `${top[0]}, ${top[1]}, and ${top[2]}`;
}

function topHormone(scores: Record<Hormone, number>, hs: Hormone[]): Hormone {
  return hs.reduce((best, h) => scores[h] > scores[best] ? h : best, hs[0]);
}

// ── Stress-Driven Plateau mirror ─────────────────────────────────────
function mirrorStress(
  score: ScoringResult,
  answers: Record<string, string>,
): string {
  const phrases: string[] = [];

  if (answers.Q3 === "belly")
    phrases.push("your weight is settling hard around your <strong>midsection</strong>");
  else if (answers.Q3 === "upper")
    phrases.push("your fat is showing up around your shoulders and upper body");

  if (answers.Q5 === "two_to_four_am")
    phrases.push("you're waking between <strong>2 and 4 AM</strong> with a busy mind");
  else if (answers.Q5 === "four_to_six_am")
    phrases.push("you're surfacing too early — around 4 to 6 AM — and can't drop back under");
  else if (answers.Q5 === "cant_fall_asleep")
    phrases.push("you're lying awake at night unable to settle in");

  if (answers.Q6 === "high_chronic")
    phrases.push("your stress has been <strong>chronic and dialled up</strong>");
  else if (answers.Q6 === "moderate" && phrases.length < 2)
    phrases.push("your stress is sitting at a moderate-but-constant level");

  if (answers.Q9 === "afternoon")
    phrases.push("your cravings hit hardest in the <strong>afternoon</strong>");
  else if (answers.Q9 === "evening")
    phrases.push("you're snacking hardest in the evening");

  if (answers.Q11 === "cant_stay_consistent")
    phrases.push("you can't seem to stay consistent long enough to see the work pay off");

  const stitched = joinPhrases(phrases);
  const para1 = stitched
    ? `<p>Based on what you shared, ${stitched}. That's not a coincidence — it's a textbook <strong>cortisol signature</strong>.</p>`
    : `<p>Based on what you shared, the strongest signals you're sending are stress-driven — your nervous system is the lever, not the food.</p>`;

  const ghrelinDom = answers.Q8 === "sudden_surges" || score.hormone_scores.ghrelin >= score.hormone_scores.cortisol;
  const para2 = stressPara2(score, answers, ghrelinDom);

  return para1 + para2;
}

function stressPara2(
  score: ScoringResult,
  answers: Record<string, string>,
  ghrelinDom: boolean,
): string {
  const flags = score.flags;
  const hbc = flags.includes("on_hormonal_birth_control");
  const meno = flags.includes("menopausal");
  const pp   = flags.includes("postpartum");

  const lead = ghrelinDom
    ? "What's likely happening: your hunger hormone (<strong>ghrelin</strong>) is firing in unpredictable surges, on top of cortisol that won't switch off."
    : "What's likely happening: chronic stress is keeping your <strong>cortisol</strong> elevated, which raises blood sugar, drives belly storage, fragments your sleep, and triggers afternoon sugar-seeking.";

  let tail: string;
  if (meno) {
    tail = " On top of menopausal recalibration, that cortisol layer is what's making weight loss feel impossible right now. Your body isn't broken — it's overloaded.";
  } else if (pp) {
    tail = " Postpartum, you have less hormonal bandwidth to absorb stress, so cortisol spikes hit harder and clear slower. Your body isn't broken — it's still rebuilding.";
  } else if (hbc) {
    tail = " Your hormonal birth control mutes most of the cycle data we'd normally read, so this pattern is showing up clearest in your sleep, stress and craving signals. Your body isn't broken — it's doing exactly what it's been signalled to do.";
  } else {
    tail = " Your body isn't broken. It's doing exactly what it's been signalled to do.";
  }

  return `<p>${lead}${tail}</p>`;
}

// ── Hormonal Shift mirror ────────────────────────────────────────────
function mirrorHormonal(
  score: ScoringResult,
  answers: Record<string, string>,
): string {
  const phrases: string[] = [];
  const flags = score.flags;
  const meno = flags.includes("menopausal");
  const pp   = flags.includes("postpartum");
  const peri = answers.Q1 === "perimenopausal";
  // "young" = fertile/non-(peri)menopausal life stage. Used to pick the
  // right narrative tone. HBC/HRT is now Q1b — anyone on contraception
  // while cycling regularly still counts as "young" here.
  const young = answers.Q1 === "cycling_regularly";

  if (meno) {
    phrases.push("your cycle has stopped and the rules have changed");
  } else if (peri) {
    phrases.push("your cycle is shifting and the protocols that worked at 30 are stalling now");
  } else if (pp) {
    phrases.push("your cycle is still finding its footing post-baby");
  } else {
    if (answers.Q2 === "heavy_painful")
      phrases.push("your cycle has turned heavy and painful");
    else if (answers.Q2 === "irregular")
      phrases.push("your cycle has gone irregular");
    else if (answers.Q2 === "light_skipping")
      phrases.push("you're skipping months or your cycle has gone light");
  }

  if (answers.Q3 === "hips")
    phrases.push("your weight is redistributing around your <strong>hips</strong>");
  else if (answers.Q3 === "belly" && (meno || peri))
    phrases.push("your weight is moving from hips to <strong>midsection</strong> — classic of this shift");

  if (answers.Q4 === "severe")
    phrases.push("your <strong>PMS or pre-period mood</strong> has gone from manageable to severe");
  else if (answers.Q4 === "moderate" && !meno)
    phrases.push("your pre-period mood is now noticeable in a way it wasn't before");

  if (answers.Q10 === "significantly_lower")
    phrases.push("your <strong>libido</strong> has dropped sharply");
  else if (answers.Q10 === "varies_with_cycle")
    phrases.push("your libido is now riding the cycle in a way it didn't used to");

  if (answers.Q11 === "almost_nothing" || answers.Q11 === "slow_progress")
    phrases.push("the training that used to work is barely moving the needle");

  const stitched = joinPhrases(phrases);
  let para1: string;
  if (young && !pp) {
    para1 = `<p>Based on what you shared, ${stitched || "your sex hormones are sending a shift signal"}. You may feel too young for this — but the perimenopausal shift can start <strong>up to 10 years</strong> before menopause itself, and what you're describing is consistent with the early end of that window.</p>`;
  } else if (meno) {
    para1 = `<p>Based on what you shared, ${stitched || "your body is recalibrating after menopause"}. <strong>Menopause</strong> has just ended one of the largest hormonal recalibrations your body will ever do — and the protocols that worked at 30 simply don't apply now.</p>`;
  } else if (pp) {
    para1 = `<p>Based on what you shared, ${stitched || "your sex hormones are still rebalancing post-baby"}. Postpartum is its own physiology — not menopausal, not perimenopausal — and most generic plans get the language wrong.</p>`;
  } else {
    para1 = `<p>Based on what you shared, ${stitched || "your sex hormones are shifting"}. Your body is doing real work — recalibrating hormones it has produced for decades. This isn't failure. This is biology.</p>`;
  }

  const topSex = topHormone(score.hormone_scores, ["estrogen", "progesterone", "testosterone"]);
  let lead: string;
  if (topSex === "estrogen") {
    lead = "What's likely happening: <strong>estrogen</strong> is the loudest signal — fluctuating high then dropping — which alters fat distribution, water retention and cravings around the cycle.";
  } else if (topSex === "progesterone") {
    lead = "What's likely happening: <strong>progesterone</strong> is the loudest signal — and when it falls, sleep gets fragile, mood narrows, and the calm hormone you used to take for granted is gone.";
  } else {
    lead = "What's likely happening: <strong>testosterone</strong> is the loudest signal — and as it drifts down, libido, muscle response and motivation all dim together.";
  }

  let tail: string;
  if (meno) {
    tail = " The fat-distribution rules change, the muscle-building rules change, and the protocols that worked at 30 stop working at 50. Strength training plus protein-forward eating becomes non-negotiable.";
  } else if (pp) {
    tail = " On top of that, postpartum reduces your nutrient and sleep buffer — which makes the shift harder to absorb. The fix isn't more discipline; it's structure that fits the new physiology.";
  } else {
    tail = " Estrogen, progesterone and testosterone are shifting — sometimes in opposite directions at the same time. The fat-distribution rules change, the muscle-building rules change, and the protocols that worked at 30 stop working at 42.";
  }

  return para1 + `<p>${lead}${tail}</p>`;
}

// ── Metabolic Resistance mirror ──────────────────────────────────────
function mirrorMetabolic(
  score: ScoringResult,
  answers: Record<string, string>,
): string {
  const phrases: string[] = [];

  if (answers.Q12 === "lose_regain")
    phrases.push("you've lost weight before and gained it back, sometimes <strong>more than you lost</strong>");
  else if (answers.Q12 === "lose_plateau")
    phrases.push("you've lost weight before only to <strong>plateau hard</strong> and stop responding");
  else if (answers.Q12 === "never_lost_what_i_want")
    phrases.push("nothing you've tried has actually moved the weight you want to move");

  if (answers.Q7 === "hard_crash")
    phrases.push("your <strong>energy crashes hard</strong> 1–2 hours after meals");
  else if (answers.Q7 === "tired_regardless")
    phrases.push("you're tired no matter what you eat");

  if (answers.Q8 === "constant_never_full")
    phrases.push("you're <strong>never genuinely full</strong>, even right after a meal");
  else if (answers.Q8 === "sudden_surges")
    phrases.push("hunger hits in unpredictable surges instead of on a schedule");

  if (answers.Q11 === "almost_nothing")
    phrases.push("exercise barely moves the needle anymore");

  if (answers.Q9 === "evening")
    phrases.push("evening cravings are running the second half of your day");

  const stitched = joinPhrases(phrases);
  const para1 = stitched
    ? `<p>Based on what you shared, ${stitched}. Your body has stopped responding to the signals it should — that's the <strong>metabolic resistance</strong> signature.</p>`
    : `<p>Based on what you shared, your fat-loss and hunger signalling have stopped responding the way they used to — that's the metabolic resistance signature.</p>`;

  const insulinDom = score.hormone_scores.insulin >= score.hormone_scores.leptin;
  let lead: string;
  if (insulinDom) {
    lead = "What's likely happening: <strong>insulin</strong> is the loudest signal — your cells aren't reading the message clearly, so blood sugar swings drive crashes, cravings and stubborn belly storage.";
  } else {
    lead = "What's likely happening: <strong>leptin</strong> — the hormone that should tell your body it has enough — has stopped being heard. So fullness doesn't register, hunger persists, and weight loss triggers more hunger, not less.";
  }

  const flags = score.flags;
  const pp = flags.includes("postpartum");
  const meno = flags.includes("menopausal");
  let tail: string;
  if (pp) {
    tail = " Postpartum amplifies this — sleep debt and undereating push insulin and leptin further out of tune, and the standard 'just diet harder' advice makes it worse.";
  } else if (meno) {
    tail = " Menopausal recalibration sits on top: lower estrogen makes insulin handling worse, which is why deficits that used to work simply stopped.";
  } else {
    tail = " Your cells are resistant. The result is a body that holds onto fat aggressively, cycles between hunger and crash, and refuses to release weight no matter what you cut.";
  }

  return para1 + `<p>${lead}${tail}</p>`;
}

// ── Compound mirror ──────────────────────────────────────────────────
function mirrorCompound(
  score: ScoringResult,
  answers: Record<string, string>,
): string {
  const phrases: string[] = [];
  if (answers.Q3 === "belly") phrases.push("belly storage");
  if (answers.Q5 === "two_to_four_am" || answers.Q5 === "four_to_six_am") phrases.push("broken sleep");
  if (answers.Q7 === "hard_crash" || answers.Q7 === "tired_regardless") phrases.push("post-meal crashes");
  if (answers.Q8 === "constant_never_full") phrases.push("never feeling full");
  if (answers.Q12 === "lose_regain" || answers.Q12 === "lose_plateau") phrases.push("regain or plateau cycles");
  if (answers.Q10 === "significantly_lower") phrases.push("a sharp drop in libido");
  if (answers.Q4 === "severe" || answers.Q4 === "moderate") phrases.push("worsening pre-period mood");

  const stitched = joinPhrases(phrases) || "stress, hormonal and metabolic signals all firing at once";
  const tried = parseQ13(answers.Q13);
  const newcomer = tried.includes("nothing") || tried.length === 0;

  const para1 = newcomer
    ? `<p>Based on what you shared, your symptoms span <strong>all three patterns</strong> — ${stitched}. About <strong>1 in 10 women</strong> score this way. The good news: you haven't been doing the wrong things — most of you haven't been given the right framework yet.</p>`
    : `<p>Based on what you shared, your symptoms span <strong>all three patterns</strong> — ${stitched}. About <strong>1 in 10 women</strong> score this way, and it almost always points to the same thing: you've been doing the right things in the <strong>wrong order</strong>.</p>`;

  // Sequencing: order the three clusters by score, suggest that order.
  const seq = sequenceClusters(score);
  const para2 =
    `<p>What's likely happening: when patterns compound, the <strong>order of intervention matters more than the intensity</strong>. Treat all three at once and nothing moves. For your specific scores, the sequence we'd start with is <strong>${seq}</strong> — one layer at a time. This is also the one pattern where bloodwork usually pays for itself before we set the plan.</p>`;

  return para1 + para2;
}

function sequenceClusters(score: ScoringResult): string {
  // Rank the three clusters high→low; address the loudest first.
  const map: Record<string, string> = {
    stress: "stress",
    hormonal_shift: "hormonal",
    metabolic: "metabolic",
  };
  const sorted = Object.entries(score.cluster_scores)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => map[k]);
  return `${sorted[0]} → ${sorted[1]} → ${sorted[2]}`;
}

// ── Objections ───────────────────────────────────────────────────────
function buildObjections(
  score: ScoringResult,
  answers: Record<string, string>,
): Objection[] {
  const tried = parseQ13(answers.Q13);
  const base = baseObjections(score.primary_archetype);

  // Each Q13 option can contribute one extra targeted objection. Cap at 4 total.
  const extras: Objection[] = [];
  for (const t of tried) {
    const o = q13Objection(t, score.primary_archetype);
    if (o && !extras.some((x) => x.title === o.title)) extras.push(o);
  }

  // If the user has no Q13 matches, return the 3 base.
  if (extras.length === 0) return base;

  // If they have 1+ extras, swap the lowest-priority base objection for the
  // first extra, and append a second extra as the 4th if available.
  // Priority of base objections is descending (index 0 = most important).
  const result = base.slice(0, 2); // keep top 2 base
  result.push(extras[0]);          // most relevant Q13 swap-in
  if (extras.length > 1) result.push(extras[1]); // 4th if a second strong match
  else result.push(base[2]);       // otherwise keep original 3rd base
  return result;
}

function parseQ13(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function baseObjections(primary: string): Objection[] {
  switch (primary) {
    case "stress_driven_plateau":
      return [
        {
          title: "Calorie cutting made it worse",
          body: "Restriction is itself a stressor. For a cortisol-driven body, eating less raises cortisol further — your body holds onto fat harder.",
        },
        {
          title: "HIIT and intense cardio backfired",
          body: "High-intensity training spikes cortisol. In your pattern, you need strength work plus walking — not more sweat sessions.",
        },
        {
          title: "Your sleep was the bigger problem",
          body: "Your night wake-ups are doing more damage than your snack drawer. Sleep repair is the first lever in your protocol — not the last.",
        },
      ];
    case "hormonal_shift":
      return [
        {
          title: "Same calories, different result",
          body: "Your body literally processes fuel differently now. The number didn't change — the rules did.",
        },
        {
          title: "Cardio-first wasn't enough",
          body: "Muscle is the new currency. Strength training is non-negotiable in this pattern, regardless of how foreign that feels.",
        },
        {
          title: "You weren't told this would happen",
          body: "Most women aren't. The hormonal shift starts up to 10 years before menopause — and most weight-loss advice ignores it entirely.",
        },
      ];
    case "metabolic_resistance":
      return [
        {
          title: "Calorie deficits stopped working",
          body: "Once leptin is dysregulated, eating less makes you hungrier and slower, not leaner. The lever isn't smaller — it's different.",
        },
        {
          title: "Carb cuts gave temporary wins",
          body: "Low-carb often works for 4–6 weeks and then plateaus. That's not failure — that's resistance reasserting itself.",
        },
        {
          title: "\"Just be patient\" was bad advice",
          body: "Patience without changing the signalling pattern is just slower failure. The protocol shift comes first — then patience.",
        },
      ];
    case "compound_pattern":
      return [
        {
          title: "Multi-front protocols failed",
          body: "When you tried to fix everything at once, nothing held. That's the compound trap, not your willpower.",
        },
        {
          title: "Generic plans treated the symptom you noticed most",
          body: "Your pattern needs sequencing, not a single tactic. One lever at a time, in the right order.",
        },
        {
          title: "You probably need bloodwork",
          body: "This is the one pattern where I'll likely recommend a panel before we set the plan — to confirm which lever to start with.",
        },
      ];
  }
  return [];
}

// Maps a single Q13 option → archetype-relevant objection.
// Returns null when the combination doesn't have a sharper variant
// (in which case we keep the base objection).
function q13Objection(tried: string, primary: string): Objection | null {
  // Universal: GLP-1 gets called out for any archetype since it changes
  // the read on hunger signals.
  if (tried === "glp1") {
    return {
      title: "GLP-1s muted the signal you needed to read",
      body: "GLP-1 medications flatten hunger and slow digestion — useful in the short term, but they hide the very signal we use to dial in the rest of your protocol. We'd plan around that, not against it.",
    };
  }
  if (tried === "functional_med") {
    return {
      title: "Functional medicine got the signal, not the protocol",
      body: "You've already had the 'it's hormonal' frame — what you've been missing is the protocol layer that connects bloodwork to daily training, eating and sleep. That's where we live.",
    };
  }
  if (tried === "noom_ww") {
    return {
      title: "Behaviour-only programs missed the physiology",
      body: "Tracking, points, and habit nudges work on the top inch of the problem. Your pattern needs the layer underneath — what your body is actually signalling, not just what you're choosing.",
    };
  }
  if (tried === "personal_trainer" || tried === "group_fitness") {
    if (primary === "stress_driven_plateau") {
      return {
        title: "More training was the wrong dose",
        body: "Trainers and group classes default to 'work harder.' For a cortisol-led pattern, harder training is fuel on the fire — your nervous system needed less, not more.",
      };
    }
    if (primary === "hormonal_shift") {
      return {
        title: "Cardio-led training wasn't built for this stage",
        body: "Most general training plans skew toward conditioning. In your shift, strength + protein is the lever. The room you trained in wasn't programming for it.",
      };
    }
    return {
      title: "The training stimulus was wrong for the signal",
      body: "More training without changing the signal pattern just adds load on a system that wasn't responding. The fix is structural, not effort-based.",
    };
  }
  if (tried === "calorie_counting") {
    if (primary === "stress_driven_plateau") {
      return {
        title: "Calorie counting cranked the dial up",
        body: "Tracking added a daily friction-stress that fed the exact cortisol pattern your scores show. The fix isn't a better app — it's removing that load.",
      };
    }
    if (primary === "metabolic_resistance") {
      return {
        title: "The calorie tracker can't see what's wrong",
        body: "The number on the app was correct. The problem is your body is no longer obeying the equation — that's a signalling issue, not a math one.",
      };
    }
    return null; // base "Same calories, different result" already covers it
  }
  if (tried === "keto") {
    if (primary === "metabolic_resistance") {
      return {
        title: "Keto's wins were mostly water",
        body: "The first 4–6 weeks of keto drop water weight as glycogen empties — which feels like a breakthrough. Your scores suggest the underlying resistance was untouched.",
      };
    }
    if (primary === "stress_driven_plateau") {
      return {
        title: "Keto added stress your body didn't have spare for",
        body: "Very low-carb is a stressor in itself. For a cortisol-led pattern, that pulled the wrong lever — and explains why energy and sleep got worse before fat loss did.",
      };
    }
    return {
      title: "Keto bought time, not a solution",
      body: "Going low-carb pauses the symptom but doesn't address the signalling. That's why the wins evaporated when you reintroduced normal eating.",
    };
  }
  if (tried === "intermittent_fasting") {
    if (primary === "stress_driven_plateau") {
      return {
        title: "Fasting amplified the cortisol you already had too much of",
        body: "Skipping meals raises morning cortisol — so fasting on top of a stress-driven pattern makes the problem louder, not quieter.",
      };
    }
    if (primary === "hormonal_shift") {
      return {
        title: "Fasting hits women in the shift hardest",
        body: "Long fasting windows cut into the protein and recovery your shifting hormones need most. It's the protocol most likely to backfire in your pattern.",
      };
    }
    return {
      title: "Fasting didn't address the signalling",
      body: "It compressed eating windows but didn't change the signals your body was sending. That's why the early wins flattened.",
    };
  }
  if (tried === "coaching") {
    return {
      title: "Generic coaching missed the pattern read",
      body: "Coaching helps when the plan is right. In your case, the plan itself wasn't matched to the pattern — accountability on a wrong protocol just makes you stick with a wrong protocol longer.",
    };
  }
  // "nothing" — no extra objection.
  return null;
}

// ── Closer (Q14) ─────────────────────────────────────────────────────
function buildCloser(answers: Record<string, string>): string {
  switch (answers.Q14) {
    case "lose_fat_no_crash":
      return "On your call we'll map the fat-loss path that doesn't tank your energy — built on your actual pattern, not a generic plan.";
    case "energy_back":
      return "On your call we'll start with the energy fix — what's draining it, and what shifts in the first two weeks.";
    case "feel_like_myself":
      return "On your call we'll work back from who you used to feel like — and what your protocol needs to look like to get there.";
    case "build_muscle":
      return "On your call we'll map the strength + protein plan that actually works inside your hormonal pattern — without burning your nervous system out.";
    case "sustainable_habits":
      return "On your call we'll cut the noise and build the smallest set of changes that hold long-term — given your specific pattern.";
    default:
      return "On your call we'll turn this map into the next 12 weeks of work — whether you choose to work with us or not.";
  }
}

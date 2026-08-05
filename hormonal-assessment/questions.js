/* ReShape Hormonal Assessment — questions data
   Display-only. The 14-question structure is canonical (matches the
   server-side weight table). The frontend never sees scoring weights.
*/
window.RESHAPE_QUESTIONS = [
  {
    id: 'Q1',
    category: 'Life stage',
    text: 'Where are you in life right now?',
    why: 'Why we ask: this sets your hormonal baseline — different life stages drive very different patterns.',
    type: 'single',
    options: [
      { value: 'cycling_regularly', label: 'Cycling regularly',         sub: 'I have a regular monthly cycle.' },
      { value: 'postpartum',        label: 'Postpartum',                 sub: 'Within ~18 months of giving birth.' },
      { value: 'perimenopausal',    label: 'Perimenopausal',             sub: 'Cycle is changing — irregular, heavier, or lighter.' },
      { value: 'menopausal',        label: 'Menopausal',                 sub: 'Periods stopped at least 12 months ago.' }
    ]
  },
  {
    id: 'Q1b',
    category: 'Life stage',
    text: 'Are you on hormonal birth control or HRT?',
    why: 'Why we ask: hormonal contraception and replacement therapy change how your symptoms read — we need to know which signals are yours vs. the medication.',
    type: 'single',
    options: [
      { value: 'none', label: 'No',                                       sub: "I'm not on any hormonal medication." },
      { value: 'hbc',  label: 'Yes — hormonal contraception',             sub: 'Pill, IUD, implant, ring, or similar.' },
      { value: 'hrt',  label: 'Yes — HRT / MHT',                          sub: 'Estrogen, progesterone, or testosterone replacement.' }
    ]
  },
  {
    id: 'Q2',
    category: 'Cycle & sex hormones',
    text: "How's your cycle been in the last 6 months?",
    why: 'Why we ask: cycle patterns are one of the strongest signals of estrogen–progesterone balance.',
    type: 'single',
    skipIf: function(answers){ return answers.Q1 === 'menopausal'; },
    skipValue: 'na',
    options: [
      { value: 'regular',        label: 'Regular and predictable',  sub: 'Comes when expected, similar each time.' },
      { value: 'heavy_painful',  label: 'Heavy or painful',          sub: 'Heavy bleeding, cramps, or both.' },
      { value: 'light_skipping', label: 'Light or skipping months',  sub: 'Lighter than usual, or skipped some months.' },
      { value: 'irregular',      label: 'Irregular and unpredictable', sub: 'Length and flow keep changing.' },
      { value: 'na',             label: "Doesn't apply right now",   sub: 'Postmenopausal, on continuous hormones, or no cycle.' }
    ]
  },
  {
    id: 'Q3',
    category: 'Body composition',
    text: 'Where does your weight tend to settle most?',
    why: 'Why we ask: where you store fat tells us which hormones are dominant.',
    type: 'single',
    options: [
      { value: 'belly', label: 'Around my belly / midsection', sub: 'Waist and lower belly hold the most.' },
      { value: 'hips',  label: 'Hips, thighs, and bottom',      sub: 'Lower body holds the most.' },
      { value: 'even',  label: 'Evenly across my body',         sub: 'Pretty much everywhere.' },
      { value: 'upper', label: 'Upper body — face, arms, back', sub: 'Upper body and arms hold the most.' }
    ]
  },
  {
    id: 'Q4',
    category: 'Cycle & sex hormones',
    text: 'PMS or mood the week before your period — how would you describe it?',
    why: 'Why we ask: severity of premenstrual symptoms is one of the strongest signals of progesterone–estrogen balance.',
    type: 'single',
    skipIf: function(answers){ return answers.Q1 === 'menopausal'; },
    skipValue: 'na',
    options: [
      { value: 'severe',   label: 'Severe',           sub: 'Anxiety, irritability, sleep is wrecked. I dread that week.' },
      { value: 'moderate', label: 'Moderate',         sub: 'Noticeable mood and energy dip. I work around it.' },
      { value: 'mild',     label: 'Mild',             sub: 'A little tired or tender. Nothing major.' },
      { value: 'none',     label: "I don't notice much", sub: 'Cycle and mood feel disconnected for me.' },
      { value: 'na',       label: 'Not applicable',   sub: 'Postmenopausal, on continuous hormones, or no cycle.' }
    ]
  },
  {
    id: 'Q5',
    category: 'Sleep & cortisol',
    text: 'When you wake at night, it\'s usually...',
    why: 'Why we ask: wake patterns tell us about cortisol rhythm.',
    type: 'single',
    options: [
      { value: 'sleep_through',    label: 'I sleep through fine',     sub: 'Out cold most nights.' },
      { value: 'two_to_four_am',   label: 'Between 2 and 4 AM',       sub: 'Wide awake with a busy mind.' },
      { value: 'four_to_six_am',   label: 'Between 4 and 6 AM',       sub: 'Up early, struggling to drop back off.' },
      { value: 'cant_fall_asleep', label: "I can't fall asleep",      sub: 'Trouble dropping off in the first place.' }
    ]
  },
  // ── Email gate fires after Q5 ──
  {
    id: 'Q6',
    category: 'Stress signals',
    text: 'How would you describe your stress level over the last 6 months?',
    why: 'Why we ask: chronic stress is the single biggest hormonal driver of weight in this age range.',
    type: 'single',
    options: [
      { value: 'high_chronic', label: 'High and chronic',     sub: 'Has been for months. Feels relentless.' },
      { value: 'moderate',     label: 'Moderate, fairly constant', sub: 'A background hum I work around.' },
      { value: 'variable',     label: 'Variable',             sub: 'Comes and goes — some weeks fine, some weeks not.' },
      { value: 'low',          label: 'Low overall',          sub: 'Pretty calm, all things considered.' }
    ]
  },
  {
    id: 'Q7',
    category: 'Blood sugar',
    text: "How's your energy 1–2 hours after a meal?",
    why: 'Why we ask: post-meal energy is a window into insulin function.',
    type: 'single',
    options: [
      { value: 'hard_crash',       label: 'Hard crash',           sub: 'I need sugar or caffeine to push through.' },
      { value: 'slight_dip',       label: 'A slight dip',          sub: 'A small dip, but I can keep going.' },
      { value: 'steady',           label: 'Steady, no real change', sub: 'Energy stays even.' },
      { value: 'tired_regardless', label: 'Tired regardless',      sub: 'No matter what I eat, I feel tired.' }
    ]
  },
  {
    id: 'Q8',
    category: 'Hunger signals',
    text: "When you're hungry, it's usually...",
    why: 'Why we ask: the shape of your hunger tells us how leptin and ghrelin are signalling.',
    type: 'single',
    options: [
      { value: 'constant_never_full', label: 'Constant — never feel full', sub: "I'm hungry most of the day." },
      { value: 'sudden_surges',       label: 'Sudden surges',               sub: 'Fine then ravenous out of nowhere.' },
      { value: 'predictable',         label: 'Predictable mealtime hunger', sub: 'Comes around mealtimes.' },
      { value: 'rarely_hungry',       label: 'I rarely feel hungry',        sub: 'Even when I should be, hunger barely shows up.' }
    ]
  },
  {
    id: 'Q9',
    category: 'Cravings',
    text: 'When do sugar or carb cravings hit hardest?',
    why: 'Why we ask: timing of cravings maps directly to specific hormones.',
    type: 'single',
    options: [
      { value: 'afternoon',     label: 'Mid-afternoon (3–5pm)',      sub: 'The afternoon slump hits and I want sugar.' },
      { value: 'evening',       label: 'Evening, after dinner',       sub: 'Cravings show up after dinner.' },
      { value: 'morning',       label: 'Morning',                     sub: 'First thing or late morning.' },
      { value: 'around_period', label: 'The week before my period',   sub: 'Strong cravings tied to the cycle.' },
      { value: 'none',          label: "I don't really get cravings", sub: 'Sugar/carb pulls are not really a thing.' }
    ]
  },
  {
    id: 'Q10',
    category: 'Sex hormones',
    text: 'Your libido / sex drive — how is it?',
    why: 'Why we ask: libido changes are one of the clearest signals of testosterone or estrogen shift.',
    type: 'single',
    options: [
      { value: 'significantly_lower', label: 'Significantly lower',  sub: 'Lower than it used to be, by a lot.' },
      { value: 'some_change',         label: 'Some change',           sub: 'Different, but not dramatically.' },
      { value: 'same',                label: 'Same as it has always been', sub: 'Not noticeably different.' },
      { value: 'varies_with_cycle',   label: 'Varies with my cycle',  sub: 'Strong in some weeks, almost nothing in others.' }
    ]
  },
  {
    id: 'Q11',
    category: 'Training response',
    text: 'When you exercise consistently for 4+ weeks, what happens?',
    why: 'Why we ask: response to training tells us about testosterone and insulin sensitivity.',
    type: 'single',
    options: [
      { value: 'real_changes',         label: 'Real changes in shape and strength', sub: 'My body responds well.' },
      { value: 'slow_progress',        label: 'Slow progress',           sub: 'It comes, just slowly.' },
      { value: 'almost_nothing',       label: 'Almost nothing happens', sub: 'Despite consistency, the needle barely moves.' },
      { value: 'cant_stay_consistent', label: "I can't stay consistent", sub: "I can't tell — life keeps interrupting." }
    ]
  },
  {
    id: 'Q12',
    category: 'Weight history',
    text: 'Your weight history... which is closest?',
    why: 'Why we ask: weight history is diagnostic. Plateau patterns differ by hormone.',
    type: 'single',
    options: [
      { value: 'never_lost_what_i_want', label: "I've never lost what I want to lose", sub: 'It has always been a battle.' },
      { value: 'lose_plateau',           label: 'I lose, then plateau hard',           sub: 'Progress stalls and refuses to move.' },
      { value: 'lose_regain',            label: 'I lose, then regain even more',        sub: 'It always comes back, plus extra.' },
      { value: 'recent_issue',           label: "It's a recent issue",                  sub: 'Last 1–3 years, things changed.' }
    ]
  },
  {
    id: 'Q13',
    category: "What you've tried",
    text: 'What have you tried? (select all that apply)',
    why: "Why we ask: helps us avoid suggesting things you've already done.",
    type: 'multi',
    options: [
      { value: 'calorie_counting',     label: 'Calorie counting',           sub: 'MyFitnessPal, Lose It!, or similar.' },
      { value: 'keto',                 label: 'Keto / low carb',             sub: 'Strict carb restriction.' },
      { value: 'intermittent_fasting', label: 'Intermittent fasting',        sub: '16:8, OMAD, or other windows.' },
      { value: 'personal_trainer',     label: '1:1 personal training',       sub: 'Sessions in a gym.' },
      { value: 'group_fitness',        label: 'Group fitness / bootcamps',   sub: 'Bootcamps, F45, CrossFit, classes.' },
      { value: 'noom_ww',              label: 'Noom, Weight Watchers, etc.', sub: 'Slimming World, WW, or similar programmes.' },
      { value: 'functional_med',       label: 'Functional medicine',         sub: 'Hormone testing, gut testing, supplements.' },
      { value: 'glp1',                 label: 'GLP-1 medication',            sub: 'Ozempic, Wegovy, Mounjaro, or similar.' },
      { value: 'coaching',             label: 'Other 1:1 coaching',          sub: 'Online or in-person coaching programmes.' },
      { value: 'nothing',              label: 'Honestly, not much yet',      sub: "I haven't really tried much." }
    ]
  },
  {
    id: 'Q14',
    category: 'Goals',
    text: 'What outcome matters most to you right now?',
    why: 'Why we ask: this anchors your protocol.',
    type: 'single',
    options: [
      { value: 'lose_fat_no_crash',  label: 'Lose fat without crashing my body', sub: 'Sustainable, not extreme.' },
      { value: 'energy_back',        label: 'Get my energy back',                sub: 'I want to feel awake again.' },
      { value: 'feel_like_myself',   label: 'Feel like myself again',            sub: "I haven't, in a while." },
      { value: 'build_muscle',       label: 'Build strength and muscle',         sub: 'Stronger body, more capable.' },
      { value: 'sustainable_habits', label: 'Build habits that actually last',   sub: 'No more yo-yo cycles.' }
    ]
  }
];

// Email gate fires AFTER this question id (i.e. after Q5, before Q6).
window.RESHAPE_GATE_AFTER = 'Q5';

/* ── SVG icons for each option value ── */
window.RESHAPE_ICONS = {
  cycling_regularly: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  postpartum: '<svg viewBox="0 0 24 24"><path d="M9 12h6M12 9v6"/><circle cx="12" cy="12" r="9"/></svg>',
  perimenopausal: '<svg viewBox="0 0 24 24"><path d="M3 12h4l3-6 4 12 3-6h4"/></svg>',
  menopausal: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 110 18 7 7 0 010-14"/></svg>',
  none_hbc: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg>',
  hbc: '<svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="2"/><circle cx="12" cy="12" r="2"/></svg>',
  hrt: '<svg viewBox="0 0 24 24"><path d="M12 2v6m0 8v6M2 12h6m8 0h6"/><circle cx="12" cy="12" r="3"/></svg>',
  regular: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>',
  heavy_painful: '<svg viewBox="0 0 24 24"><path d="M12 3c-2 4-6 6-6 10a6 6 0 0012 0c0-4-4-6-6-10z"/></svg>',
  light_skipping: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M8 8h2M14 8h2M8 16h2M14 16h2" stroke-dasharray="2 2"/></svg>',
  irregular: '<svg viewBox="0 0 24 24"><path d="M3 12h4l2-4 2 8 2-6 2 4 2-2h4"/></svg>',
  na: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  belly: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14" rx="6" ry="5"/><path d="M12 3v6"/></svg>',
  hips: '<svg viewBox="0 0 24 24"><path d="M8 4h8M6 8c0 4-2 8 0 12h12c2-4 0-8 0-12"/></svg>',
  even: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="12" height="16" rx="6"/></svg>',
  upper: '<svg viewBox="0 0 24 24"><path d="M8 20V12c0-4 2-8 4-8s4 4 4 8v8"/></svg>',
  severe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 16c0-2 2-3 4-3s4 1 4 3"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/></svg>',
  moderate_pms: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 15h8"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/></svg>',
  mild: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 14c1 1 2.5 2 4 2s3-1 4-2"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/></svg>',
  none_pms: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 13c1 2 2.5 3 4 3s3-1 4-3"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/></svg>',
  sleep_through: '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/></svg>',
  two_to_four_am: '<svg viewBox="0 0 24 24"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/><circle cx="12" cy="12" r="4"/></svg>',
  four_to_six_am: '<svg viewBox="0 0 24 24"><path d="M17 18a5 5 0 00-10 0"/><path d="M12 9V2"/><path d="M4.22 10.22l1.42 1.42M18.36 10.22l-1.42 1.42"/></svg>',
  cant_fall_asleep: '<svg viewBox="0 0 24 24"><path d="M2 12h2M6.34 6.34l1.42 1.42M12 2v2M17.66 6.34l-1.42 1.42M22 12h-2"/><circle cx="12" cy="12" r="4"/><path d="M12 16v5"/></svg>',
  high_chronic: '<svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  moderate_stress: '<svg viewBox="0 0 24 24"><path d="M3 12h18" opacity=".6"/><path d="M3 8h18" opacity=".3"/><path d="M3 16h18" opacity=".9"/></svg>',
  variable: '<svg viewBox="0 0 24 24"><path d="M3 12h4l3-4 4 8 3-4h4"/></svg>',
  low: '<svg viewBox="0 0 24 24"><path d="M3 16h18M3 12h18M3 8h18" opacity=".4"/></svg>',
  hard_crash: '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l4 4M18 14l-4 4"/></svg>',
  slight_dip: '<svg viewBox="0 0 24 24"><path d="M3 8h4l4 4 4-2h6"/></svg>',
  steady: '<svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M8 8v8M12 8v8M16 8v8" opacity=".3"/></svg>',
  tired_regardless: '<svg viewBox="0 0 24 24"><path d="M12 2v4M4.93 4.93l2.83 2.83M2 12h4M20 12h-4M17.66 6.34l-2.83 2.83"/><circle cx="12" cy="14" r="4"/><path d="M12 18v4"/></svg>',
  constant_never_full: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/></svg>',
  sudden_surges: '<svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  predictable: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></svg>',
  rarely_hungry: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>',
  afternoon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l-1.42-1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l-1.42 1.42"/></svg>',
  evening: '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/></svg>',
  morning: '<svg viewBox="0 0 24 24"><path d="M17 18a5 5 0 00-10 0"/><path d="M12 9V2"/><path d="M4.22 10.22l1.42 1.42M18.36 10.22l-1.42 1.42"/></svg>',
  around_period: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>',
  none_cravings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg>',
  significantly_lower: '<svg viewBox="0 0 24 24"><path d="M3 7l6 6 4-4 8 8"/><path d="M17 17h4v-4"/></svg>',
  some_change: '<svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M16 8l4 4-4 4"/></svg>',
  same: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  varies_with_cycle: '<svg viewBox="0 0 24 24"><path d="M3 12h2l2-4 3 8 3-6 2 4 2-2h4"/></svg>',
  real_changes: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>',
  slow_progress: '<svg viewBox="0 0 24 24"><path d="M3 15l18-4"/></svg>',
  almost_nothing: '<svg viewBox="0 0 24 24"><path d="M3 12h18"/></svg>',
  cant_stay_consistent: '<svg viewBox="0 0 24 24"><path d="M3 12h4l2-3 2 6 2-4 2 3h6" stroke-dasharray="3 2"/></svg>',
  never_lost_what_i_want: '<svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M12 3v18" opacity=".3"/></svg>',
  lose_plateau: '<svg viewBox="0 0 24 24"><path d="M3 8l6 6h12"/></svg>',
  lose_regain: '<svg viewBox="0 0 24 24"><path d="M3 8l5 5-2 3 5-3 2 5 4-8 4 2"/></svg>',
  recent_issue: '<svg viewBox="0 0 24 24"><path d="M3 12h10l4 6h4"/></svg>',
  calorie_counting: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h5M8 15h8"/></svg>',
  keto: '<svg viewBox="0 0 24 24"><path d="M12 2C8 2 4 6 4 12s4 10 8 10"/><path d="M12 2c4 0 8 4 8 10s-4 10-8 10" stroke-dasharray="3 3"/></svg>',
  intermittent_fasting: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/><path d="M12 3v2M12 19v2"/></svg>',
  personal_trainer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="3"/><path d="M5 12h14M7 12v6a2 2 0 002 2h6a2 2 0 002-2v-6"/></svg>',
  group_fitness: '<svg viewBox="0 0 24 24"><circle cx="8" cy="5" r="2"/><circle cx="16" cy="5" r="2"/><circle cx="12" cy="4" r="2.5"/><path d="M3 20v-3a4 4 0 018 0v3M13 20v-3a4 4 0 018 0v3"/></svg>',
  noom_ww: '<svg viewBox="0 0 24 24"><path d="M12 20V4"/><path d="M4 12l8-8 8 8"/></svg>',
  functional_med: '<svg viewBox="0 0 24 24"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>',
  glp1: '<svg viewBox="0 0 24 24"><path d="M12 3v14M9 14h6"/><circle cx="12" cy="20" r="2"/></svg>',
  coaching: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  nothing: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  lose_fat_no_crash: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>',
  energy_back: '<svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  feel_like_myself: '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>',
  build_muscle: '<svg viewBox="0 0 24 24"><path d="M4 15l2-6h2l2 6M14 15l2-6h2l2 6M10 12h4"/></svg>',
  sustainable_habits: '<svg viewBox="0 0 24 24"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12"/><path d="M2 12c0 5.523 4.477 10 10 10" stroke-dasharray="3 3"/><path d="M8 12l3 3 5-5"/></svg>'
};

window.RESHAPE_GET_ICON = function(qId, value) {
  var I = window.RESHAPE_ICONS;
  if (qId === 'Q1b' && value === 'none') return I.none_hbc;
  if (qId === 'Q4' && value === 'none') return I.none_pms;
  if (qId === 'Q4' && value === 'moderate') return I.moderate_pms;
  if (qId === 'Q4' && value === 'na') return I.na;
  if (qId === 'Q9' && value === 'none') return I.none_cravings;
  if (qId === 'Q6' && value === 'moderate') return I.moderate_stress;
  return I[value] || '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>';
};

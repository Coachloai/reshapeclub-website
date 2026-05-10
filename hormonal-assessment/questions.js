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
      { value: 'on_hbc',            label: 'On hormonal birth control',  sub: 'Pill, IUD, implant, ring, or similar.' },
      { value: 'postpartum',        label: 'Postpartum',                 sub: 'Within ~18 months of giving birth.' },
      { value: 'perimenopausal',    label: 'Perimenopausal',             sub: 'Cycle is changing — irregular, heavier, or lighter.' },
      { value: 'menopausal',        label: 'Menopausal',                 sub: 'Periods stopped at least 12 months ago.' }
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

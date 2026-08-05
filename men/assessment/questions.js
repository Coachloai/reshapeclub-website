/* ReShape Men's Performance Assessment — questions data
   12-question structure covering testosterone, growth hormone, cortisol,
   insulin, and lifestyle factors for underperforming men 30-55.
*/
window.RESHAPE_QUESTIONS = [
  {
    id: 'MQ1',
    category: 'Where you are',
    text: 'How old are you?',
    why: 'Why we ask: testosterone, GH, and cortisol shift differently by decade. This sets your baseline.',
    type: 'single',
    options: [
      { value: '30_35', label: '30–35', sub: 'Early shift — subtle but real.' },
      { value: '36_40', label: '36–40', sub: 'Mid-30s decline is accelerating.' },
      { value: '41_45', label: '41–45', sub: 'The drop is measurable now.' },
      { value: '46_50', label: '46–50', sub: 'Andropause territory.' },
      { value: '50_plus', label: '50+', sub: 'Optimisation, not resignation.' }
    ]
  },
  {
    id: 'MQ2',
    category: 'Energy & drive',
    text: 'How would you describe your energy on a typical workday?',
    why: 'Why we ask: sustained energy is a direct marker of testosterone output and cortisol rhythm.',
    type: 'single',
    options: [
      { value: 'crashed_by_2pm', label: 'Crashed by 2pm',       sub: 'I need coffee just to function past lunch.' },
      { value: 'afternoon_dip',  label: 'Noticeable afternoon dip', sub: 'I push through but the sharpness is gone.' },
      { value: 'variable',       label: 'Unpredictable',        sub: 'Some days fine, some days I\'m running on fumes.' },
      { value: 'solid',          label: 'Solid all day',         sub: 'I don\'t really have energy issues.' }
    ]
  },
  {
    id: 'MQ3',
    category: 'Body composition',
    text: 'Where is fat settling that it didn\'t 5 years ago?',
    why: 'Why we ask: where you store fat tells us which hormones have shifted.',
    type: 'single',
    options: [
      { value: 'belly',    label: 'Belly and love handles',   sub: 'Midsection won\'t budge regardless.' },
      { value: 'chest',    label: 'Chest and upper body',     sub: 'Softer upper body, losing definition.' },
      { value: 'all_over', label: 'Everywhere, gradually',    sub: 'A slow thickening I can\'t outrun.' },
      { value: 'nowhere',  label: 'Not really gaining fat',   sub: 'My issue is more energy/performance.' }
    ]
  },
  {
    id: 'MQ4',
    category: 'Sleep & recovery',
    text: 'How\'s your sleep?',
    why: 'Why we ask: 70% of daily GH release happens during deep sleep. Poor sleep kills testosterone production.',
    type: 'single',
    options: [
      { value: 'wired_cant_sleep', label: 'Wired at night, can\'t switch off', sub: 'Mind races the moment I lie down.' },
      { value: 'wake_3am',         label: 'I wake at 3–4am and can\'t get back', sub: 'Up with a cortisol spike, mind running.' },
      { value: 'light_unrefreshed', label: 'I sleep but never feel rested',   sub: '7+ hours and still tired.' },
      { value: 'sleep_fine',        label: 'Sleep is solid',                  sub: '6–8 hours, wake feeling decent.' }
    ]
  },
  {
    id: 'MQ5',
    category: 'Stress load',
    text: 'Be honest: what\'s your stress been like for the last 6 months?',
    why: 'Why we ask: chronic cortisol elevation is the single biggest driver of testosterone suppression in successful men.',
    type: 'single',
    options: [
      { value: 'relentless',    label: 'Relentless',          sub: 'Work, family, finances — it never stops.' },
      { value: 'high_managed',  label: 'High but I manage it', sub: 'I\'m functioning, but running on reserves.' },
      { value: 'moderate',      label: 'Moderate',            sub: 'Normal life stress, nothing extreme.' },
      { value: 'low',           label: 'Actually pretty low',  sub: 'Life\'s in a good place right now.' }
    ]
  },
  // ── Email gate fires after Q5 ──
  {
    id: 'MQ6',
    category: 'Strength & performance',
    text: 'What\'s happening in the gym (or with your training)?',
    why: 'Why we ask: training response is one of the clearest windows into anabolic hormone status.',
    type: 'single',
    options: [
      { value: 'not_training',      label: 'I\'m not really training',       sub: 'Can\'t find the drive or time.' },
      { value: 'going_no_results',  label: 'Going, but nothing\'s changing', sub: 'Same weights, same body, same frustration.' },
      { value: 'regressing',        label: 'Getting weaker or slower',       sub: 'Lifts dropping, recovery taking forever.' },
      { value: 'progressing',       label: 'Still progressing',              sub: 'Strength and performance are moving.' }
    ]
  },
  {
    id: 'MQ7',
    category: 'Drive & motivation',
    text: 'How would you describe your motivation and competitive edge?',
    why: 'Why we ask: drive, ambition, and competitive fire are testosterone-mediated behaviours.',
    type: 'single',
    options: [
      { value: 'gone',       label: 'Gone',                         sub: 'The fire I used to have just isn\'t there.' },
      { value: 'dulled',     label: 'Dulled',                       sub: 'I go through the motions but the edge is missing.' },
      { value: 'inconsistent', label: 'Comes and goes',             sub: 'Bursts of drive, then flatlines.' },
      { value: 'strong',     label: 'Still sharp',                  sub: 'Ambition and drive haven\'t changed.' }
    ]
  },
  {
    id: 'MQ8',
    category: 'Recovery & inflammation',
    text: 'After a hard session or a physical day, how long does recovery take?',
    why: 'Why we ask: recovery speed maps directly to GH output and systemic inflammation.',
    type: 'single',
    options: [
      { value: 'days',        label: '3+ days of soreness or fatigue', sub: 'I feel wrecked for days afterwards.' },
      { value: 'slow',        label: '48 hours — noticeably slower',   sub: 'Used to bounce back, now it lingers.' },
      { value: 'normal',      label: 'Next day I\'m fine',             sub: 'Normal recovery, nothing unusual.' },
      { value: 'fast',        label: 'I recover quickly',              sub: 'Ready to go again within 24 hours.' }
    ]
  },
  {
    id: 'MQ9',
    category: 'Libido & sexual health',
    text: 'Let\'s talk about libido — how is it, honestly?',
    why: 'Why we ask: libido is the most sensitive early marker of testosterone status. No judgement, just data.',
    type: 'single',
    options: [
      { value: 'nonexistent',    label: 'Basically non-existent',    sub: 'It\'s gone. I barely think about it.' },
      { value: 'noticeably_lower', label: 'Noticeably lower',        sub: 'Still there, but nothing like it was.' },
      { value: 'fluctuating',    label: 'Fluctuates',                sub: 'Good some weeks, nothing other weeks.' },
      { value: 'fine',           label: 'Same as it\'s always been', sub: 'No complaints.' }
    ]
  },
  {
    id: 'MQ10',
    category: 'Blood sugar & appetite',
    text: 'What happens to your energy 1–2 hours after a meal?',
    why: 'Why we ask: post-meal energy reveals how your insulin is functioning — a key lever in body composition.',
    type: 'single',
    options: [
      { value: 'food_coma',    label: 'Food coma',               sub: 'I could sleep at my desk after lunch.' },
      { value: 'slight_dip',   label: 'Slight dip',              sub: 'Minor lull but I push through.' },
      { value: 'steady',       label: 'Steady',                  sub: 'Energy stays consistent after eating.' },
      { value: 'wired',        label: 'Wired, then crash later', sub: 'Spike of energy, then I hit a wall.' }
    ]
  },
  {
    id: 'MQ11',
    category: "What you've tried",
    text: 'What have you tried to fix this? (select all that apply)',
    why: 'Why we ask: so we don\'t waste your time suggesting things that already failed.',
    type: 'multi',
    options: [
      { value: 'gym_more',          label: 'More gym time',             sub: 'Just training harder or more often.' },
      { value: 'calorie_cutting',   label: 'Calorie cutting',           sub: 'MyFitnessPal, deficit diets, etc.' },
      { value: 'supplements',       label: 'Testosterone supplements',  sub: 'Test boosters, ashwagandha, ZMA, etc.' },
      { value: 'trt',               label: 'TRT / hormone clinic',      sub: 'Explored or started replacement therapy.' },
      { value: 'keto_carnivore',    label: 'Keto / Carnivore',          sub: 'Low carb or meat-based protocols.' },
      { value: 'fasting',           label: 'Intermittent fasting',      sub: '16:8, OMAD, extended fasts.' },
      { value: 'personal_trainer',  label: 'Personal trainer',          sub: '1:1 sessions in a gym.' },
      { value: 'nothing',           label: 'Honestly, not much',        sub: 'I\'ve been too busy to properly address it.' }
    ]
  },
  {
    id: 'MQ12',
    category: 'Your priority',
    text: 'If you could fix one thing in the next 12 weeks, what would it be?',
    why: 'Why we ask: this anchors your protocol to what actually matters to you.',
    type: 'single',
    options: [
      { value: 'lose_gut',        label: 'Lose the gut',                sub: 'I want my body back.' },
      { value: 'energy_back',     label: 'Get my energy and drive back', sub: 'I want to feel like I used to.' },
      { value: 'build_strength',  label: 'Build real strength',          sub: 'Muscle, power, and performance.' },
      { value: 'sleep_recover',   label: 'Fix my sleep and recovery',    sub: 'If I could sleep, everything else would follow.' },
      { value: 'all_of_it',       label: 'All of the above',             sub: 'I need a full reset.' }
    ]
  }
];

// Email gate fires AFTER this question id.
window.RESHAPE_GATE_AFTER = 'MQ5';

/* ── SVG icons for each option value ── */
window.RESHAPE_ICONS = {
  '30_35': '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  '36_40': '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  '41_45': '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  '46_50': '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  '50_plus': '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  crashed_by_2pm: '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l4 4M18 14l-4 4"/></svg>',
  afternoon_dip: '<svg viewBox="0 0 24 24"><path d="M3 8h4l4 4 4-2h6"/></svg>',
  variable: '<svg viewBox="0 0 24 24"><path d="M3 12h4l3-4 4 8 3-4h4"/></svg>',
  solid: '<svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M8 8v8M12 8v8M16 8v8" opacity=".3"/></svg>',
  belly: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14" rx="6" ry="5"/><path d="M12 3v6"/></svg>',
  chest: '<svg viewBox="0 0 24 24"><path d="M8 4h8M6 8c0 4-2 8 0 12h12c2-4 0-8 0-12"/></svg>',
  all_over: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="12" height="16" rx="6"/></svg>',
  nowhere: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg>',
  wired_cant_sleep: '<svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  wake_3am: '<svg viewBox="0 0 24 24"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2"/><circle cx="12" cy="12" r="4"/></svg>',
  light_unrefreshed: '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/></svg>',
  sleep_fine: '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/></svg>',
  relentless: '<svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  high_managed: '<svg viewBox="0 0 24 24"><path d="M3 12h18" opacity=".9"/><path d="M3 8h18" opacity=".5"/><path d="M3 16h18" opacity=".3"/></svg>',
  moderate: '<svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M3 8h18M3 16h18" opacity=".3"/></svg>',
  low: '<svg viewBox="0 0 24 24"><path d="M3 16h18M3 12h18M3 8h18" opacity=".4"/></svg>',
  not_training: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  going_no_results: '<svg viewBox="0 0 24 24"><path d="M3 12h18"/></svg>',
  regressing: '<svg viewBox="0 0 24 24"><path d="M3 7l6 6 4-4 8 8"/><path d="M17 17h4v-4"/></svg>',
  progressing: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>',
  gone: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 16c0-2 2-3 4-3s4 1 4 3"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/></svg>',
  dulled: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 15h8"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/></svg>',
  inconsistent: '<svg viewBox="0 0 24 24"><path d="M3 12h2l2-4 3 8 3-6 2 4 2-2h4"/></svg>',
  strong: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 13c1 2 2.5 3 4 3s3-1 4-3"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/></svg>',
  days: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>',
  slow: '<svg viewBox="0 0 24 24"><path d="M3 15l18-4"/></svg>',
  normal: '<svg viewBox="0 0 24 24"><path d="M3 12h18"/></svg>',
  fast: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>',
  nonexistent: '<svg viewBox="0 0 24 24"><path d="M3 7l6 6 4-4 8 8"/><path d="M17 17h4v-4"/></svg>',
  noticeably_lower: '<svg viewBox="0 0 24 24"><path d="M3 8l6 6h12"/></svg>',
  fluctuating: '<svg viewBox="0 0 24 24"><path d="M3 12h4l2-4 2 8 2-6 2 4 2-2h4"/></svg>',
  fine: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  food_coma: '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l4 4M18 14l-4 4"/></svg>',
  slight_dip: '<svg viewBox="0 0 24 24"><path d="M3 8h4l4 4 4-2h6"/></svg>',
  steady: '<svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M8 8v8M12 8v8M16 8v8" opacity=".3"/></svg>',
  wired: '<svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  gym_more: '<svg viewBox="0 0 24 24"><path d="M4 15l2-6h2l2 6M14 15l2-6h2l2 6M10 12h4"/></svg>',
  calorie_cutting: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h5M8 15h8"/></svg>',
  supplements: '<svg viewBox="0 0 24 24"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>',
  trt: '<svg viewBox="0 0 24 24"><path d="M12 3v14M9 14h6"/><circle cx="12" cy="20" r="2"/></svg>',
  keto_carnivore: '<svg viewBox="0 0 24 24"><path d="M12 2C8 2 4 6 4 12s4 10 8 10"/><path d="M12 2c4 0 8 4 8 10s-4 10-8 10" stroke-dasharray="3 3"/></svg>',
  fasting: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/><path d="M12 3v2M12 19v2"/></svg>',
  personal_trainer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="3"/><path d="M5 12h14M7 12v6a2 2 0 002 2h6a2 2 0 002-2v-6"/></svg>',
  nothing: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  lose_gut: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>',
  energy_back: '<svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  build_strength: '<svg viewBox="0 0 24 24"><path d="M4 15l2-6h2l2 6M14 15l2-6h2l2 6M10 12h4"/></svg>',
  sleep_recover: '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/></svg>',
  all_of_it: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg>'
};

window.RESHAPE_GET_ICON = function(qId, value) {
  return window.RESHAPE_ICONS[value] || '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>';
};

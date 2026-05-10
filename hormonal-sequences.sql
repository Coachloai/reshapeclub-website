-- ============================================================
-- ReShape Hormonal Assessment — Nurture Sequences
-- Run this SQL in your Supabase SQL Editor after creating
-- the automation_sequences and automation_steps tables.
-- ============================================================

-- ============================================================
-- 0. Create tables if they don't exist
-- ============================================================

CREATE TABLE IF NOT EXISTS automation_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES automation_sequences(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  delay_seconds INT NOT NULL DEFAULT 0,
  subject TEXT,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_auto_steps_seq ON automation_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_auto_steps_order ON automation_steps(sequence_id, step_order);

ALTER TABLE automation_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "auto_seq_read" ON automation_sequences FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "auto_seq_insert" ON automation_sequences FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "auto_seq_update" ON automation_sequences FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "auto_seq_delete" ON automation_sequences FOR DELETE USING (true);

CREATE POLICY IF NOT EXISTS "auto_steps_read" ON automation_steps FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "auto_steps_insert" ON automation_steps FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "auto_steps_update" ON automation_steps FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "auto_steps_delete" ON automation_steps FOR DELETE USING (true);


-- ============================================================
-- SEQUENCE A — assessment_abandoned
-- Trigger: started assessment but didn't finish
-- 3 emails + 1 WhatsApp over 72 hours
-- ============================================================

INSERT INTO automation_sequences (id, name, trigger_type, description, is_active)
VALUES (
  gen_random_uuid(),
  'Assessment Abandoned',
  'assessment_abandoned',
  'Triggered when a user starts the hormonal assessment but does not finish. 3 emails + 1 WhatsApp over a 72-hour window. Saved answers referenced throughout.',
  true
);

-- A1 — 1 hour after · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_abandoned'),
  1,
  'email',
  3600,
  'You stopped partway through',
  E'{first_name} — you got partway through the ReShape assessment and stopped.\n\nYour answers are saved. There''s about 90 seconds of questions left. You''ll get your hormonal pattern report at the end.\n\nThe plan that worked in your 20s isn''t supposed to work in your 40s. The pattern report is where you find out which hormones are actually driving your plateau.\n\n— Loai & Sean\nReShape · Ipswich & Colchester',
  true
);

-- A2 — 24 hours after · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_abandoned'),
  2,
  'email',
  86400,
  'Most women stop at the same question',
  E'The question most women stall on isn''t a hard one. It''s usually one that asks them to admit something to themselves on a screen — "how often do you wake up exhausted", "is your weight settling somewhere new", "is your cycle different than it used to be".\n\nThe answer isn''t fun to type out.\n\nBut typing it out is also the first useful thing you can do with it. The pattern report tells you what those symptoms have in common — and which of the seven hormones is driving them.\n\nYour saved answers are still there.',
  true
);

-- A-WA — 36 hours after · WHATSAPP
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_abandoned'),
  3,
  'whatsapp',
  129600,
  NULL,
  E'Hey {first_name}, it''s Sean from ReShape — saw your assessment is sitting half-finished. Your answers clear in about 36 hours so wanted to flag it. 90 seconds to wrap it up: {book_link} Reply STOP if you''d rather we didn''t message.',
  true
);

-- A3 — 72 hours after · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_abandoned'),
  4,
  'email',
  259200,
  'Last reminder — saved answers expire today',
  E'{first_name} — your saved assessment answers clear from our system tonight.\n\nIf you want to finish it on the answers you''ve already given, today is the day. Otherwise it''s a fresh start later.\n\nNo further reminders after this one. If now isn''t the moment, no problem — we''ll be here when it is.\n\n— Loai & Sean',
  true
);


-- ============================================================
-- SEQUENCE B — assessment_completed
-- Trigger: finished assessment, didn't book consultation within 24h
-- 20 emails + 4 WhatsApp + 2 SMS over 90 days
-- ============================================================

INSERT INTO automation_sequences (id, name, trigger_type, description, is_active)
VALUES (
  gen_random_uuid(),
  'Assessment Completed — Nurture',
  'assessment_completed',
  'Triggered when a user finishes the hormonal assessment but does not book a consultation within 24 hours. 20 emails + 4 WhatsApp + 2 SMS over 90 days across four phases.',
  true
);

-- ────────────────────────────────────────────────
-- Phase 1 — Days 0-7
-- ────────────────────────────────────────────────

-- B1 — Immediate · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  1,
  'email',
  0,
  '{first_name}, your hormonal pattern report',
  E'{first_name}, your pattern report is below.\n\nBased on your 14 answers, the strongest signal in your results points to {pattern}. It''s a pattern we see often, and it''s almost always missed by standard advice.\n\nHere''s what it usually feels like day-to-day:\n\n• Energy crashes in the afternoon, regardless of sleep\n• Weight that won''t shift despite doing everything "right"\n• A body that feels like it stopped responding to the things that used to work\n\nRecognise yourself in that?\n\nWhat this report doesn''t tell you: How severe yours is. Why it set in. What to actually do about it. For that, you need 45 minutes with one of us.\n\nThe consultation is free. There''s no card, no upsell, and about 30% of women who take it don''t end up working with us. We still send them their plan.\n\nOver the next few days I''ll send you the things every woman with this pattern should know. Read them or don''t — they''re yours.\n\n— Loai\nReShape · Ipswich & Colchester\n\nThe ReShape Assessment is a screening tool, not a medical diagnostic. Always consult your healthcare provider before changing nutrition protocols.',
  true
);

-- B2 — Day 1 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  2,
  'email',
  86400,
  'Why "eat less, move more" doesn''t work for {pattern}',
  E'Yesterday''s pattern report flagged {pattern}. Today, the part nobody explains.\n\nWhen your hormonal rhythm is dysregulated, your body misreads safety. It doesn''t matter how clean you eat or how often you train — if your nervous system thinks it''s under threat, it holds weight, retains water, suppresses thyroid output, and breaks your sleep architecture.\n\nThat''s why women in this pattern keep saying "I''m doing everything right and nothing is working". They are doing everything right. The thing they''re doing it on top of is broken.\n\nThe fix is a sequence: regulate first, optimise second, build third. Skip the regulation and the rest doesn''t stick. That''s why generic plans keep failing women in their 30s and 40s — they jump straight to step three.\n\nThe 12-week ReShape programme is built around this sequence. And it comes with a guarantee that no other programme in the country will give you: drop 8-12kg in 12 weeks, or we coach you free until you do. We''ve delivered it 1,200+ times.',
  true
);

-- B3 — Day 2 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  3,
  'email',
  172800,
  'She was stressed, plateaued, and exhausted',
  E'When Annabel came to ReShape, here''s what she''d already done:\n\n• Tried three different diets in two years\n• Trained 4-5 times a week\n• "Did everything right" — and her body wouldn''t move\n\nHer assessment showed a stress-driven hypothyroidism pattern — high cortisol load suppressing thyroid output. Standard advice (eat less, train more) was actively making it worse.\n\nSix months on the ReShape programme, Annabel reshaped around her hormones instead of fighting them.\n\n"I finally stopped blaming myself and started understanding what my body actually needed. The weight came off because the approach changed — not because I tried harder."\n— Annabel, 30s, ReShape member\n\nAnnabel''s result isn''t typical or guaranteed for everyone — every body is different. The principle that worked for her, though, is the same one we''d apply to you.',
  true
);

-- B-WA1 — Day 3 · WHATSAPP
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  4,
  'whatsapp',
  259200,
  NULL,
  E'Hey {first_name}, it''s Loai from ReShape. Had a look at your assessment — wanted to say one quick thing because {pattern} is one we see a lot, and there''s a piece of it that almost nobody gets right. Your body isn''t broken. It''s protecting itself. And the fix isn''t more discipline — it''s a different sequence. If you want me to walk you through what that means for you specifically, the consultation''s the place. Either way, hope that''s useful. \U0001F44B',
  true
);

-- B4 — Day 4 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  5,
  'email',
  345600,
  '"I''m not sure this is for me"',
  E'Three things women tell us when they hesitate to book the consultation.\n\n1. "I don''t think it''s bad enough." If you''re searching, it''s bad enough. The women who get the best outcomes are the ones who came to us before they hit crisis — not after.\n\n2. "I should try something else first." Something else is usually another diet, another supplement, another protocol. If your hormonal pattern is what''s driving the plateau, the next thing sits on top of the problem instead of resolving it. That''s why nothing''s working.\n\n3. "What if I book and it''s not for me?" About 30% of the women who take a consultation don''t end up joining the programme. We tell them so on the day, and we still send them their plan. The consultation is how we both decide if it''s a fit. It costs nothing and you leave with clarity either way.\n\n— Sean',
  true
);

-- B-SMS1 — Day 5 · SMS
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  6,
  'sms',
  432000,
  NULL,
  E'ReShape: Hi {first_name}, your pattern report flagged {pattern}. We''ve held a consultation slot for you this week — book here: {book_link}. Reply STOP to opt out.',
  true
);

-- B5 — Day 7 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  7,
  'email',
  604800,
  'A week ago, you completed the assessment',
  E'A week ago, you took 3 minutes and answered 14 questions about your symptoms. That''s more than most women do — most keep googling, keep guessing, keep waiting.\n\nThe next step is 45 minutes with Loai or Sean. They''ll have read your assessment in detail before you arrive — no chatbot, no script, no junior staff.\n\nWhat you''ll leave with:\n\n• What your pattern actually means clinically\n• The 2-3 things most likely driving your specific plateau\n• Whether the 12-week ReShape programme is right for you (and if it isn''t, what is)\n• Real numbers — programme cost, structure, timing — so you can decide without surprises\n\nReply if you''d rather ask me a question first. I read every reply.\n\n— Loai',
  true
);

-- ────────────────────────────────────────────────
-- Phase 2 — Days 8-30
-- ────────────────────────────────────────────────

-- B6 — Day 10 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  8,
  'email',
  864000,
  'Why most "balance your hormones naturally" advice is rubbish',
  E'Every week there''s a new Instagram post telling women to seed cycle their way out of a hormonal plateau. Or that "adrenal fatigue" is the reason they''re knackered. Or that a smoothie with maca and ashwagandha will sort everything.\n\nHere''s the problem: none of that is wrong enough to be obviously wrong. It''s just incomplete enough to waste your time.\n\nSeed cycling won''t fix a dysregulated cortisol rhythm. "Adrenal fatigue" isn''t a real diagnosis — what''s actually happening is HPA axis dysfunction, and the fix is structural, not supplemental. And adaptogens are fine as far as they go, but they''re treating a symptom while the pattern underneath carries on.\n\nThe reason this stuff gets shared is because it sounds plausible and it''s easy to sell. The reason it doesn''t work is because hormonal patterns are systems, not single switches.\n\nIf you want this kind of clarity applied to your specific pattern — the consultation is the place.',
  true
);

-- B7 — Day 13 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  9,
  'email',
  1123200,
  'What {pattern} actually does to your body',
  E'Pure primer. No story, no pitch.\n\nYour assessment flagged {pattern}. Here''s what that means physiologically.\n\nThe pattern involves a cascade: when one hormone is chronically elevated or suppressed, it pulls others with it. Think of it as a chain reaction — cortisol affects thyroid, thyroid affects metabolism, disrupted metabolism affects insulin, insulin affects fat storage, and fat storage produces oestrogen, which feeds back into the loop.\n\nStandard advice fails because it targets one link in the chain. Cut calories — metabolism drops further. Add cardio — cortisol rises. Take a supplement — one hormone shifts while the rest compensate.\n\nAn actual fix sequence looks like this: first, identify which hormones are primary drivers (that''s what the assessment maps). Second, regulate the nervous system and sleep architecture. Third, restructure nutrition around the pattern, not against it. Fourth, build from a stable base.\n\nWhat you can do this week regardless of whether you book: get morning sunlight in the first hour after waking. Hit 30g protein at breakfast within 60 minutes of getting up. No caffeine until you''ve eaten.\n\nThese help. They won''t fix the underlying pattern. If you want this applied to your specific report, that''s what the consultation is for.\n\nBook your free consultation \U2192 {book_link}',
  true
);

-- B-WA2 — Day 15 · WHATSAPP
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  10,
  'whatsapp',
  1296000,
  NULL,
  E'Quick one {first_name} — Sean here. Working on a piece about {pattern} today and thought you might find it useful given your assessment. Want me to send when it''s done?',
  true
);

-- B8 — Day 17 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  11,
  'email',
  1468800,
  'She had her thyroid removed. She still went from UK 16 to UK 6.',
  E'Most coaches would have said it wasn''t possible.\n\nJaime came to ReShape after a thyroidectomy. No thyroid gland at all. Every doctor and every nutritionist she''d spoken to told her the same thing: manage expectations, this is your new normal.\n\nHer assessment showed what we expected — a post-thyroidectomy pattern with secondary insulin resistance. Standard advice was never going to work because it was designed for women whose thyroid is underperforming, not absent.\n\nWe built a protocol around what she had, not what she was missing. Regulation first. Nutrition restructured around her actual hormonal output. No generic meal plans. No calorie deficits.\n\nUK 16 to UK 6 in 12 months.\n\n"I was told this was impossible. ReShape didn''t just prove them wrong — they gave me my confidence back."\n— Jaime, ReShape member\n\nResults aren''t typical or guaranteed. Every body is different. But the principle — reshape around your hormones, not against them — is what we''d apply to you.',
  true
);

-- B9 — Day 21 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  12,
  'email',
  1814400,
  '"Or we coach you free until you do"',
  E'Most prospects skim past our guarantee on the website. So let me make you stop and read it.\n\nThe guarantee: drop 8-12kg in 12 weeks, or we coach you free until you do.\n\nNo other programme in the UK offers this. The reason is simple — most can''t deliver on it.\n\nThe conditions: complete the programme. Follow the system. Not "try it for a week then skip three sessions". Show up, do the work, follow the nutrition protocol your nutritionist builds for you. If you do that and don''t get the result — we keep coaching you at no extra cost until you do.\n\nHow often is it triggered? We''ve delivered this programme 1,200+ times. The vast majority hit their target inside the 12 weeks. A small percentage needed an extension. We''ve never had someone complete the programme fully and not get there eventually.\n\nWhat happens if you''re someone we don''t think will benefit? We tell you. On the consultation. Before any money changes hands. About 30% of the women who take a consultation don''t end up joining — because we''re honest about fit.\n\nThat''s the deal.',
  true
);

-- B-WA3 — Day 24 · WHATSAPP
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  13,
  'whatsapp',
  2073600,
  NULL,
  E'Hey {first_name}, holding two consultation slots this week — Wednesday at 7pm or Thursday at 10am. Either work? Reply 1 or 2. Or grab any slot here: {book_link}',
  true
);

-- B10 — Day 25 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  14,
  'email',
  2160000,
  'The seven hormones we map — and why it''s seven, not three',
  E'Most "hormone reset" content focuses on 2-3 hormones — usually oestrogen and cortisol. The complete picture is seven, and they interact.\n\nHere''s what the ReShape assessment maps:\n\n1. Oestrogen — drives fat distribution, especially post-35. Dominance creates a specific storage pattern.\n2. Progesterone — the calming hormone. When it drops, anxiety, bloating, and sleep disruption follow.\n3. Testosterone — not just for men. Low testosterone in women means muscle loss, fatigue, and low drive.\n4. Cortisol — the stress hormone. Chronically elevated cortisol overrides everything else.\n5. Insulin — regulates blood sugar. Resistance drives fat storage even on a "clean" diet.\n6. Leptin — the satiety signal. Resistance means your brain never gets the "full" message.\n7. Ghrelin — the hunger hormone. Dysregulated sleep sends it through the roof.\n\nSingle-hormone fixes fail because they ignore the system. Fix cortisol but ignore insulin — the pattern shifts, it doesn''t resolve. That''s why generic plans keep failing.\n\nYour assessment maps all seven. The consultation is where we look at which two or three are doing the most damage in your specific case.\n\nBook your free consultation \U2192 {book_link}',
  true
);

-- B11 — Day 29 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  15,
  'email',
  2505600,
  'Three things to do this week — book or don''t',
  E'No pitch. No CTA at the end. Just three things that help.\n\n1. Morning sunlight in the first hour after waking. Not through a window — outside, 10-15 minutes. This resets your cortisol rhythm, which is the single biggest lever for {pattern}.\n\n2. 30g protein at breakfast within 60 minutes of getting up. This stabilises blood sugar for the morning and reduces the afternoon crash that drives evening overeating.\n\n3. No caffeine until you''ve eaten. Coffee on an empty stomach spikes cortisol and disrupts the regulation you''re trying to build.\n\nThese help. They won''t fix the underlying pattern. That''s the work we do in the 12-week programme. But they''re a good place to start regardless.\n\n— Loai & Sean',
  true
);

-- ────────────────────────────────────────────────
-- Phase 3 — Days 31-60
-- ────────────────────────────────────────────────

-- B12 — Day 35 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  16,
  'email',
  3024000,
  'Sara was 7 weeks in when she felt alive again',
  E'"I''m 7 weeks into my ReShape journey. Not only am I 1 stone lighter — I feel alive again. I joined to break bad habits and kick start a healthier lifestyle. I would not have the self discipline to go to an average gym. Thankfully I discovered ReShape."\n— Sara Brittain, ReShape member\n\nSara didn''t come to ReShape for a quick fix. She came because she was stuck — doing the things she thought she should be doing, not seeing results, and losing motivation because of it.\n\nWhat changed wasn''t her effort. It was the approach. Instead of more restriction and more willpower, we restructured around her actual hormonal pattern. The weight came off as a byproduct of getting the system right.\n\n7 weeks. 1 stone. And — more importantly — she felt alive again. Not knackered, not frustrated, not blaming herself.\n\nResults aren''t typical or guaranteed. But the approach is the same one we''d build for you.',
  true
);

-- B13 — Day 40 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  17,
  'email',
  3456000,
  'Why your bloods came back "normal" but you feel like rubbish',
  E'This one hits a nerve for most women over 30.\n\nYou go to your GP. You list the symptoms — exhaustion, weight gain, brain fog, disrupted sleep, low mood. They run bloods. Everything comes back "within normal range". You''re told you''re fine.\n\nBut you''re not fine. You know you''re not fine.\n\nHere''s what''s happening: NHS blood panels use reference ranges designed to catch disease. They''re not designed to catch dysfunction. The gap between "clinically ill" and "optimally functioning" is enormous — and that''s where most women in their 30s and 40s are sitting.\n\nYour cortisol might be "normal" — but normal for a stressed, sleep-deprived 40-year-old, which is a very different thing from optimal. Your thyroid might be "fine" — but fine at the bottom of a range that spans a huge functional spectrum.\n\nThe ReShape assessment isn''t a blood panel — we said that on the homepage and we''ll say it again. But the symptom patterns it picks up are usually the same patterns you''d find on labs if anyone bothered to look at them properly.\n\nThe consultation is where we decide if labs make sense for you.\n\nBook your free consultation \U2192 {book_link}',
  true
);

-- B-WA4 — Day 44 · WHATSAPP
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  18,
  'whatsapp',
  3801600,
  NULL,
  E'Saw something today that reminded me of your assessment, {first_name}. One of our members had a very similar {pattern} profile to yours — she''s 10 weeks in now and the shift has been remarkable. Sending in case it''s useful. Let me know if you want me to walk you through what we did differently for her. — Loai',
  true
);

-- B14 — Day 46 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  19,
  'email',
  3974400,
  'Five things our members said this month',
  E'From verified Google reviews — real members, real words.\n\n"I''ve finally got my energy back. I''m not relying on caffeine to get through the afternoon any more."\n— K., 8 weeks in\n\n"I sleep through the night now. That alone was worth it. The fact I''ve dropped a dress size is a bonus."\n— T., 12 weeks in\n\n"I stopped hating food. ReShape changed my relationship with eating in a way no diet ever did."\n— M., 6 months in\n\n"I look in the mirror and recognise myself again. I didn''t realise how much I''d lost until I got it back."\n— S., 4 months in\n\n"Two stone down. No crash diets. No calorie counting. Just a plan that actually works with my body instead of against it."\n— J., 14 weeks in\n\n1,200+ transformations. 28,000+ kg lost. 92% completion rate. 5.0 stars across 500+ Google reviews.',
  true
);

-- B15 — Day 52 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  20,
  'email',
  4492800,
  'Who ReShape isn''t for',
  E'Saving us both time.\n\nReShape isn''t for:\n\n• Women looking for a quick fix to fit into a dress in 4 weeks. We don''t do quick fixes. The 12-week programme is built for lasting change, not short-term drops that bounce back.\n\n• Anyone who isn''t willing to commit 12 weeks. Not 12 perfect weeks — but 12 weeks of showing up, following the protocol, and trusting the process.\n\n• Women whose primary issue is medical, not nutritional. If what''s going on needs a GP or specialist first, we''ll tell you that straight. We have before.\n\n• Anyone who can''t stop self-blaming long enough to look at the system. Not a willpower problem. A pattern problem. If you''re not ready to hear that, the programme won''t land.\n\nIf none of those are you — and most likely they aren''t — we should talk.',
  true
);

-- B16 — Day 58 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  21,
  'email',
  5011200,
  'Two months on — your pattern report is still true',
  E'{first_name} — two months ago you completed the ReShape assessment.\n\nSince then:\n\n• Your pattern report hasn''t changed\n• Your symptoms haven''t changed\n• Your body is still doing what it was doing\n\nThe only variable is whether you decide to do something about it.\n\nThis isn''t pressure. It''s a fact. The pattern doesn''t resolve on its own — it typically deepens with age, especially through perimenopause. What works now gets harder at 45, harder again at 50.\n\nThe consultation is 45 minutes, free, and about 30% of the women who take it don''t end up working with us. We still send them their plan.\n\nIf you''ve been waiting for the right moment — this is as good as any.',
  true
);

-- ────────────────────────────────────────────────
-- Phase 4 — Days 61-90
-- ────────────────────────────────────────────────

-- B17 — Day 65 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  22,
  'email',
  5616000,
  'Are you still in?',
  E'{first_name} — straight question.\n\nTwo months ago you took the assessment. Since then I''ve been sending things based on your pattern report. Some you''ve opened, some you haven''t.\n\nIs this still on your radar?\n\nIf yes — let''s stop the dance. Book the consultation.\n\nBook your free consultation \U2192 {book_link}\n\nIf no — that''s fine. Tell me and I''ll take you off the active list.\n\n— Loai',
  true
);

-- B18 — Day 73 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  23,
  'email',
  6307200,
  'Jessica spent years trying everything before she came to us',
  E'Hesitating is normal. Staying stuck isn''t.\n\nJessica was vegetarian, lifelong plateau, had tried everything she could find online. Every programme, every protocol, every supplement stack some influencer recommended. Nothing shifted.\n\nShe almost didn''t book the consultation. "I''d been burned too many times to believe anything would be different."\n\nWhat was different: we didn''t ask her to eat more meat. We didn''t put her on a 1,200-calorie plan. We looked at her hormonal pattern and built a protocol that worked with her body and her values — not against them.\n\n"I wish I''d come sooner. Not because I was desperate — because I wasted years trying things that were never going to work for me."\n— Jessica, ReShape member\n\nResults aren''t typical or guaranteed. But the principle — stop fighting your body, start working with it — applies to everyone.',
  true
);

-- B19 — Day 82 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  24,
  'email',
  7084800,
  'One last thing, regardless of what you decide',
  E'The single most important habit for {pattern}.\n\nRegardless of whether you ever book a consultation, do this one thing: restructure your morning.\n\nGet outside within 60 minutes of waking. No phone first. Sunlight on your face — even on an overcast UK day, outdoor light intensity is 10-50x what you get indoors. This resets your circadian cortisol rhythm, which is the master switch for everything downstream — thyroid function, insulin sensitivity, sleep architecture, appetite regulation.\n\nThen eat. 30g protein minimum. Eggs, Greek yoghurt, whatever works. Before caffeine. Caffeine on an empty stomach spikes cortisol and undoes the reset you just did.\n\nThese two things — morning light and a protein-first breakfast — are free, evidence-based, and effective for any hormonal pattern. They won''t fix everything. But they''re the foundation that everything else sits on.\n\nIf any of this has been useful, you know where we are.\n\nBook your free consultation \U2192 {book_link}\n\n— Loai & Sean',
  true
);

-- B-SMS2 — Day 86 · SMS
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  25,
  'sms',
  7430400,
  NULL,
  E'ReShape: Final note from Loai. You finished your assessment 90 days ago. If you''d like to book before we close your file: {book_link}. Otherwise no further texts. STOP to opt out.',
  true
);

-- B20 — Day 89 · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'assessment_completed'),
  26,
  'email',
  7689600,
  'I''m going to stop emailing you now',
  E'{first_name},\n\nI''ve sent you about 20 emails over the last three months. You''ve opened some, ignored some — that''s normal.\n\nWhat I don''t want is to keep arriving in your inbox if it''s no longer welcome. So I''m taking you off this sequence at the end of the week.\n\nTwo doors:\n\n1. You''re still considering it. Book the consultation. I''ll personally make sure it''s a good use of your time.\n\nBook your free consultation \U2192 {book_link}\n\n2. You''re not, and that''s fine. Do nothing. You''ll come off the active list and only get our occasional newsletter — which you can opt out of any time.\n\nEither way: thanks for trusting us with your assessment. Hope something in these emails was useful.\n\n— Loai',
  true
);


-- ============================================================
-- SEQUENCE C — consultation_booked
-- Trigger: booked a consultation (pre-visit)
-- 5 emails + 2 SMS + 2 WhatsApp
-- ============================================================

INSERT INTO automation_sequences (id, name, trigger_type, description, is_active)
VALUES (
  gen_random_uuid(),
  'Consultation Booked — Pre-Visit',
  'consultation_booked',
  'Triggered when a user books a free consultation. 5 emails + 2 SMS + 2 WhatsApp. Includes pre-visit reminders with negative delay_seconds (relative to consultation datetime).',
  true
);

-- C1 — Immediate · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'consultation_booked'),
  1,
  'email',
  0,
  'Booked: your consultation, {date} at {time}',
  E'{first_name}, you''re in.\n\n{date} at {time} — 45 minutes with {coach} at {location}.\n\nTwo things to do before we meet:\n\n1. Have your pattern report in mind. {coach} will be referencing it throughout.\n\n2. Have your top three questions written down. We have 45 minutes — let''s not waste them on small talk.\n\nWhat we''ll cover:\n\n• What your pattern actually means clinically\n• The 2-3 things most likely driving your plateau\n• Whether the 12-week programme is right for you (and if it isn''t, what is)\n• The investment, the structure, the guarantee — no surprises\n\nIf something comes up and you can''t make it, please rebook rather than no-show. We hold the slot for you and turn down others to do it.\n\nSee you {date}.\n\n— {coach}',
  true
);

-- C2 — 1 day after booking · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'consultation_booked'),
  2,
  'email',
  86400,
  'Three things worth reading before we meet',
  E'So you arrive prepared, not cold.\n\n1. Your pattern report — reread it. {coach} will have studied it in detail. The more familiar you are with what it flagged, the more useful the 45 minutes will be.\n\n2. The guarantee: drop 8-12kg in 12 weeks, or we coach you free until you do. Understand the conditions — complete the programme, follow the system. We''ll walk through it in person.\n\n3. Your questions. Not "what''s the programme like" — that''s what the consultation is for. Think bigger: what would need to be true for you to commit 12 weeks? What''s stopped you before? What does success actually look like for you?\n\nCome ready and we''ll make the most of the time.\n\n— {coach}',
  true
);

-- C4-EMAIL — 24h before consultation · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'consultation_booked'),
  3,
  'email',
  -86400,
  'Tomorrow at {time} — final prep',
  E'{first_name}, your consultation with {coach} is tomorrow at {time}, {location}.\n\nPattern report. Top three questions. That''s all you need.\n\nIf you need to move it, please rebook rather than no-show — we hold your slot and turn others away.\n\nSee you tomorrow.\n\n— {coach}',
  true
);

-- C4-SMS — 24h before consultation · SMS
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'consultation_booked'),
  4,
  'sms',
  -86400,
  NULL,
  E'ReShape: Hi {first_name}, reminder — your consultation with {coach} is tomorrow at {time}. Need to move it? {book_link}. Reply C to confirm.',
  true
);

-- C4-WA — 24h before consultation · WHATSAPP
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'consultation_booked'),
  5,
  'whatsapp',
  -86400,
  NULL,
  E'Hey {first_name}, looking forward to meeting you tomorrow at {time}. Have your pattern report handy and your top questions ready. Anything specific you want me to make sure we cover? Just reply here. — {coach}',
  true
);

-- C5-SMS — 1h before consultation · SMS
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'consultation_booked'),
  6,
  'sms',
  -3600,
  NULL,
  E'ReShape: {first_name}, your consultation with {coach} starts in 1 hour at {location}. See you soon.',
  true
);

-- C5-WA — 1h before consultation · WHATSAPP
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'consultation_booked'),
  7,
  'whatsapp',
  -3600,
  NULL,
  E'Hey {first_name}, see you in an hour at {location}! \U0001F4AA — {coach}',
  true
);


-- ============================================================
-- SEQUENCE D — consultation_cancelled
-- Trigger: cancelled their consultation
-- 3 emails + 1 WhatsApp over 7 days
-- ============================================================

INSERT INTO automation_sequences (id, name, trigger_type, description, is_active)
VALUES (
  gen_random_uuid(),
  'Consultation Cancelled',
  'consultation_cancelled',
  'Triggered when a user cancels their booked consultation. 3 emails + 1 WhatsApp over 7 days. Aims to rebook or gracefully defer.',
  true
);

-- D1 — Immediate · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'consultation_cancelled'),
  1,
  'email',
  0,
  'Cancellation confirmed — let''s pick a better time',
  E'{first_name}, your consultation is cancelled — no problem, life happens.\n\nThe pattern in your assessment is still there, though, and it isn''t going to resolve itself in the meantime.\n\nPick a slot when you''ve actually got 45 quiet minutes. Don''t squeeze this between school run and Tesco.\n\nOr hit reply and tell me what''s going on — I might be able to make this work for you a different way.\n\n— {coach}',
  true
);

-- D-WA — 24h after · WHATSAPP
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'consultation_cancelled'),
  2,
  'whatsapp',
  86400,
  NULL,
  E'Hey {first_name} — saw the cancellation went through. No worries. Want me to send two slots that might work better, or would you rather pick yourself? {book_link}',
  true
);

-- D2 — 3 days · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'consultation_cancelled'),
  3,
  'email',
  259200,
  'Still on the cards?',
  E'{first_name} — quick check-in. No pressure.\n\nYour consultation slot was cancelled but your assessment and pattern report are still on file.\n\nTwo options:\n\n1. Rebook now \U2192 {book_link}\n2. Not the right time — reply "later" and I''ll check back in 30 days.\n\nEither way, no hard feelings.\n\n— {coach}',
  true
);

-- D3 — 7 days · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'consultation_cancelled'),
  4,
  'email',
  604800,
  'Door''s open whenever you''re ready',
  E'{first_name} — last note about the cancellation.\n\nYour assessment is on file. Your pattern report is valid. When you''re ready, the consultation is still free.\n\nIn the meantime, I''ll keep sending you the educational emails based on your {pattern} results — they''re useful regardless of whether you book. If you''d rather not receive them, just reply and I''ll sort it.\n\n— {coach}',
  true
);


-- ============================================================
-- SEQUENCE E — consultation_noshow
-- Trigger: didn't show up for consultation
-- 3 emails + 1 SMS + 1 WhatsApp over 7 days
-- ============================================================

INSERT INTO automation_sequences (id, name, trigger_type, description, is_active)
VALUES (
  gen_random_uuid(),
  'Consultation No-Show',
  'consultation_noshow',
  'Triggered when a user does not show up for their booked consultation. 3 emails + 1 SMS + 1 WhatsApp over 7 days. Friendly tone, easy rebook.',
  true
);

-- E1 — 30 min after start time · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'consultation_noshow'),
  1,
  'email',
  1800,
  'Missed you — no problem',
  E'{first_name}, looks like we missed each other today. Happens all the time, no concern at all.\n\nWhether something came up or the timing wasn''t right, the easiest thing is to pick a slot you know will work.\n\nNo follow-up needed if today''s not your day — we can find a moment that is.\n\n— {coach}',
  true
);

-- E-SMS — 1h after · SMS
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'consultation_noshow'),
  2,
  'sms',
  3600,
  NULL,
  E'ReShape: Hi {first_name}, we had you on the schedule for {time} today. All good — pick a new slot when it suits: {book_link}.',
  true
);

-- E2 — 24h after · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'consultation_noshow'),
  3,
  'email',
  86400,
  'Three slots for you this week',
  E'{first_name}, no rush — but if you''d like to rebook this week, here are three options.\n\nThe easiest way is to pick whatever works.\n\nBook your free consultation \U2192 {book_link}\n\nYour assessment and pattern report are still on file. {coach} will have reviewed everything before you arrive.\n\nIf now''s not the right month, just reply "later" and I''ll check back in 30 days.\n\n— {coach}',
  true
);

-- E-WA — 48h after · WHATSAPP
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'consultation_noshow'),
  4,
  'whatsapp',
  172800,
  NULL,
  E'Hey {first_name}, no rush — but if you''d like a slot this week or next, reply with a time that works and I''ll send a one-click link. Or if now''s not the right month, just say "later" and I''ll check back in 30 days. — {coach}',
  true
);

-- E3 — 7 days · EMAIL
INSERT INTO automation_steps (id, sequence_id, step_order, channel, delay_seconds, subject, body, is_active)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM automation_sequences WHERE trigger_type = 'consultation_noshow'),
  5,
  'email',
  604800,
  'Last note about the missed consultation',
  E'{first_name} — final message about this.\n\nYour assessment is on file. Your pattern report is valid. When you''re ready, the consultation is still free and {coach} will have read your results before you arrive.\n\nAfter today, you''ll continue receiving the educational emails based on your {pattern} results. They''re useful regardless.\n\nWhenever you''re ready.\n\nBook your free consultation \U2192 {book_link}\n\n— {coach}',
  true
);


-- ============================================================
-- Summary
-- ============================================================
-- Sequence A (assessment_abandoned):   4 steps  (3 email, 1 whatsapp)
-- Sequence B (assessment_completed):  26 steps  (20 email, 4 whatsapp, 2 sms)
-- Sequence C (consultation_booked):    7 steps  (3 email, 2 sms, 2 whatsapp) — note: pre-visit steps use negative delay_seconds
-- Sequence D (consultation_cancelled): 4 steps  (3 email, 1 whatsapp)
-- Sequence E (consultation_noshow):    5 steps  (3 email, 1 sms, 1 whatsapp)
-- Total: 5 sequences, 46 steps

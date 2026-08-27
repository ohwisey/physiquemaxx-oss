# PROMPTS

The actual prompts that run the physique analysis.
Plus a recipe for prompting an AI to build an app like this.

Two parts:

- **Part A** — the app's real prompts, and why they are shaped that way.
- **Part B** — how to prompt an AI to build a similar app.

Everything in Part A is quoted from the open-source code.
Files:

- `src/lib/analysis/prompts.ts`
- `src/lib/analysis/rubric.ts`
- `src/lib/analysis/scoring.ts`
- `src/lib/analysis/schemas.ts`

---

# Part A — The app's prompts

## The big idea

The app never asks one AI "rate this physique".
That produces slop: made-up scores, mood swings, flattery.

Instead it runs three stages.

```
photos ─► STAGE 1  AI looks at photos, writes down only what it SEES
              │
              ▼
         STAGE 2  plain code does ALL the math (no AI)
              │
              ▼
         STAGE 3  AI writes the words, using only Stage 2's numbers
```

The AI is used twice.
Once to look. Once to talk.
The scoring in the middle is code, so it is the same every time.

Why split it up:
The AI cannot invent the score, cannot pick the weak spots, cannot make up the workout.
Those are decided by code it cannot touch.

Two rules apply to both AI calls:

- **Temperature 0.** The lowest, most repeatable setting. Same photos, same answer.
- **Strict schema.** The AI must return JSON in an exact shape. Bad shape gets one retry, then a clean failure. It never fakes a result.

---

## Stage 1 — Look at the photos

The AI gets the photos and one job: report what is visible.
No scores. No verdict. No workout.

The instruction it receives (the system prompt), quoted from `prompts.ts`:

```
You are the vision-evidence stage of a three-stage physique analysis
pipeline for a private two-person physique log. You extract structured,
visible evidence from standardized check-in photographs. Later
deterministic code computes every score and status — you never compute an
overall score, never assign red/green status, never rank priorities, never
name exercises, and never write user-facing prose beyond short evidence
observations.
```

Then it is told exactly what JSON to return:

```
Return a single JSON object and nothing else — no markdown, no code fences,
no commentary before or after.
```

**Why this shape:**

- **"You never compute a score."** Boundaries stated up front. The AI is only allowed to be eyes, not a judge. This is what stops the slop.
- **"Return a single JSON object and nothing else."** The output is fed to code. Code cannot read chit-chat. It needs clean JSON.

### The photo quality gate

Before anything, each photo is scored 0 to 100 on six things:

```
1. Framing — full body visible, consistent crop and framing.
2. Sharpness — no severe blur.
3. Lighting — adequate and consistent with the session.
4. Camera geometry — same camera height, lens and distance; no distortion.
5. Pose compliance — relaxed standardized pose; no pump, no flexing.
6. Visibility — target musculature actually visible (clothing, obstruction).
```

Some problems are "hard failures" that make a photo untrustworthy.
The prompt forces a machine-readable tag:

```
A view with a hard failure MUST score below 40 and its issues array MUST
begin with the exact matching slug(s), verbatim — deterministic code keys
on them — followed by exact, actionable retake guidance.
```

**Why:**
The AI writes for a human ("reshoot with the lens wiped") but must also drop an exact code word like `severe_blur` first.
Code reads the code word. The human reads the rest.
One field serves both.

### Evidence only, no guessing

```
- Report only what is visible in the provided photographs. No inference
  beyond the pixels.
- Every observation cites the single view it was seen in. Something seen in
  two views becomes two evidence items.
- Never mistake shadows, skin tone, tanning, vascularity, lighting,
  leanness, or a pump for muscle development. These are confounders: they
  lower confidence and may appear as quality issues — they never raise an
  anchor.
```

**Why:**
A tan is not a bigger muscle. A pump is not growth.
Listing the traps that fool the eye keeps the read honest.

### Anchors, not fake decimals

The AI rates each muscle on a five-step scale, not a made-up number:

```
A0 = major visible development gap.
A1 = clear lag materially harming the target proportions.
A2 = slight but actionable lag.
A3 = target met, maintain.
A4 = standout development.
```

**Why:**
"A2" means one clear thing.
"53.7 out of 100" pretends to a precision a photo cannot give.
Five plain steps are honest and repeatable.

### Confidence

Every muscle rating carries a `confidence` from 0 to 1.
Weak evidence, one angle, bad light: low number.
Later, code throws away anything under the bar.

---

## Stage 2 — The math (no AI)

There is no prompt here.
This stage is plain code in `scoring.ts` and `rubric.ts`.

It takes Stage 1's evidence and computes:

- Pass / partial / fail on the photos.
- Red / green / not-assessable per muscle.
- The overall score.
- The one or two muscles to prioritize.

The overall score is a fixed recipe, from `rubric.ts`:

```
development  50%
proportion   25%
symmetry     15%
conditioning 10%
```

The muscle to fix first is ranked by a fixed formula:

```
priorityScore = 0.40·gap + 0.30·importance + 0.20·confidence + 0.10·crossAngle
```

**Why this is code, not AI:**

- Same input gives the same output. Every time. Forever.
- The score cannot drift because the AI was in a mood.
- You can read the formula. Nothing is hidden.

One hard rule the code obeys:

```
Never alters, rounds up, or re-interprets Stage 1 anchors or confidence.
```

A partial capture still gets a score. Components the photos could not show
are dropped and the remaining weights are renormalised, so three visible
muscle groups still produce a real number.

The one thing it will not do is invent evidence. An empty asymmetry list on a
front-only shot means "we could not see it", not "you are balanced", so
symmetry is dropped from the weighting rather than scored as a perfect 100.

Only a set with nothing usable at all gets no score, and that returns retake
instructions instead.

---

## Stage 3 — Write the words

Now the AI comes back.
It gets Stage 2's finished numbers as text.
No photos this time.
Its only job is to turn the result into plain, honest language.

From `prompts.ts`, the hard limits:

```
- Never change or restate incorrectly any score, status, anchor, priority,
  exercise, or dosage.
- Never use a number that does not literally appear in the input. Write
  other quantities as words ("six-week block") — the input's digits are the
  only digits allowed in your output.
```

**Why:**
The AI cannot quietly bump a score while "just writing it up".
It can only reuse numbers it was handed.
A number it was not given is a rule break, caught by code.

### The tone contract

```
Required:
- Verdict first.
- Maximum 35 words.
- Name one strongest area.
- Name no more than two bottlenecks.
- Every criticism cites visible evidence.
- Every criticism ends with a practical action.
- Say NOT ASSESSABLE when evidence is weak.
- No compliment sandwich.
- Do not invent praise to protect feelings.
- Do not invent criticism merely to appear brutal.
```

The tone it aims for:

```
"Your chest is not the current problem. Your shoulder width is. The lateral
delts trail your arms and waist proportions, so they should be the next
six-week specialization."
```

And a banned list:

```
- "It's over."
- "Pathetic."
- "Disgusting."
- "Bad genetics."
- Attractiveness, masculinity, worth, or sexual judgments.
- Medical or hormonal conclusions.
- Exact body-fat claims from photographs.
- Generic filler such as "stay consistent," "eat clean," or "keep working
  hard."
```

**Why:**
Direct but useful. Not cruel, not soft.
Every knock must point at a fix.
No filler, no fake kindness, no medical claims a photo cannot support.

---

## The safety net — the schema

Both AI calls must return JSON in an exact shape.
That shape is checked in code (`schemas.ts`) before anything is trusted.

The narration check literally counts words and scans for banned language:

```
verdict must be at most 35 words
```

```
FORBIDDEN_PHRASES = [
  "it's over", "pathetic", "disgusting", "bad genetics",
  "stay consistent", "eat clean", "keep working hard",
]
```

It even blocks a body-fat percentage claim or a medical word with a pattern match.

The number check is the clever bit.
Before the call, code collects every digit that appeared in the input.
The AI's words may only contain those digits:

```
contains the number 47, which was not in the input
```

If any check fails:

```
a failed parse triggers exactly one retry, then a clean failure.
```

**Why:**

- The AI's promises in the prompt are not enough. Code verifies them.
- One retry covers a fluke. A second failure fails honestly rather than shipping junk.
- Nothing fake is ever saved.

---

## Why versions are stamped

Every prompt and rule table carries a version number.
`PROMPT_VERSION`, `RUBRIC_VERSION`, `SCORING_VERSION`, `SCHEMA_VERSION`.

Each saved analysis records which versions produced it.

**Why:**
Change the wording, bump the version.
Old scores are never silently compared against new rules.
A score means the same thing as the score next to it, or it is not compared at all.

---

# Part B — How to prompt an AI to build an app like this

You do not need to code.
You need to describe the machine clearly, in the right order.

This is the recipe. It works for any "AI judges something from input" app:
photos, essays, resumes, form submissions.

## Step 1 — Write a tight brief

Keep it to a page. Answer these:

- **What goes in?** (Photos of X. Text of Y.)
- **What comes out?** (A score, a status, a short verdict, a next action.)
- **What must never happen?** (No made-up numbers. No cruelty. No medical claims.)

A good brief is mostly "never" rules.
Those are what keep an AI honest.

Paste it like this:

```
Build a tool that takes [inputs] and returns [outputs].
Hard rules:
- The AI must never invent a score.
- The AI must only report what it can see or read.
- Output must be checkable JSON, not free text.
- If input quality is too low, say so. Never fake a result.
```

## Step 2 — Ask for three stages, not one

This is the whole trick. Say it plainly:

```
Do not use one AI call. Use a three-stage pipeline.

Stage 1: the AI looks at the input and reports only observations, as JSON.
         It does not score, rank, or conclude anything.
Stage 2: plain code does all the scoring and ranking. No AI.
Stage 3: the AI writes the final words, using only Stage 2's numbers.
```

Why insist on this:
The middle stage is code you control.
The AI can never touch the score.

## Step 3 — Spec the scoring rule as a table

Do not let the AI decide the weights. You decide. Hand it a table.

```
Build the overall score in code as:
- Component A: 50%
- Component B: 25%
- Component C: 15%
- Component D: 10%

Rate each item on a fixed scale with named steps, not decimals:
- Step 0: major gap
- Step 1: clear lag
- Step 2: slight lag
- Step 3: target met
- Step 4: standout

Map each step to a number in code. The AI picks the step. Code does the math.
```

Named steps beat decimals.
"Step 2" is honest. "53.7" is a guess dressed as a fact.

## Step 4 — Add a quality gate

Bad input should be caught before judging.

```
Before scoring, rate the input quality 0 to 100 on [your criteria].
Some problems make the input unusable. Tag those with an exact code word,
so my code can act on it.
If quality is too low, return retake instructions only. Do not score.
```

## Step 5 — Demand strict JSON with a schema

```
Every AI call must return JSON in an exact shape.
Validate it in code before trusting it. (Use a schema library.)
If the shape is wrong, retry once, then fail cleanly. Never save a bad result.
```

This one line prevents most disasters.

## Step 6 — Write the tone contract

If the output is words, spell out the voice. Required, allowed, forbidden.

```
The final text must:
- Lead with the verdict.
- Stay under [N] words.
- Back every criticism with evidence.
- End every criticism with an action.

It must never:
- Use cruel or personal language.
- Make medical claims.
- Use filler like "stay consistent".
- Use any number not in the data.
```

Then enforce it in code, not just the prompt:

```
After the AI replies, check the text in code:
- Count the words. Reject if over the cap.
- Scan for banned phrases. Reject if found.
- Reject any number that was not in the input data.
Retry once on any failure.
```

The prompt is a request.
The code check is the guarantee.

## Step 7 — Pin the settings

```
Use temperature 0 on every AI call, so the same input gives the same output.
Keep any API key on the server only. Never in the browser, never in the app's
public code, never in a screenshot.
```

## Step 8 — Version everything

```
Give the prompt, the scoring rules, and the schema each a version number.
Save which versions produced each result.
Never compare two results made under different major versions.
```

## Step 9 — Iterate in small, testable steps

Do not ask for the whole app at once. Build the spine first, then fill in.

Good order:

1. "Build Stage 2, the scoring code, with fake input. Show me it is the same every run."
2. "Now Stage 1. Make the AI return only observations, in this JSON shape."
3. "Now the schema check and the one retry."
4. "Now Stage 3, the words, with the tone contract and the number check."
5. "Now wire the three together."

After each step, ask:

```
Show me one worked example, start to finish.
Then show me what happens when the input is bad.
```

If the bad-input case fakes an answer, the pipeline is wrong. Send it back.

---

## The one thing to remember

Do not ask an AI to judge and score in one breath.

Make it **look** first.
Do the **math in code**.
Then let it **talk**, using only the numbers the code produced.

That is the whole difference between a real tool and a slot machine.

# The starter prompt

One prompt. Fill in one blank. Paste it into Claude Code, Codex, or any AI that
can write code.

It does not build a physique tracker. It builds **your** thing, using the
architecture that made this one work — and it explains itself as it goes, so
you learn the pattern instead of just receiving code.

---

## Copy this

```
I want to build [DESCRIBE YOUR THING — for example: an app that rates my guitar
playing from a video / scores a CV against a job ad / grades how tidy a room is
from a photo].

Build it with me, and teach me while you do it. I want to understand the
choices, not just receive code.

Follow this architecture. It is the important part.

1. THREE STAGES, NEVER ONE CALL
   Stage 1 — the AI only looks at the input and reports what it observes, as
   strict JSON. No scores. No conclusions. No advice.
   Stage 2 — plain code takes that evidence and does ALL the scoring against a
   fixed rubric I can read. No AI in this stage at all.
   Stage 3 — the AI writes the final words using only Stage 2's numbers. It may
   not invent a number, a category, or a claim.

2. THE SCORE LIVES IN CODE
   Write the rubric as a table of weights that add up to 100. The same input
   must always produce the same score. If I run it twice, nothing moves.

3. CHECK THE AI, DO NOT TRUST IT
   After every AI reply, validate it in code: correct shape, inside the limits,
   no banned phrases, and no number that did not appear in the input. Retry
   once, then fail honestly. Never show me a made-up answer.

4. HANDLE BAD INPUT HONESTLY
   If the input is too poor to judge, say so and tell me exactly how to fix it.
   Score what can be seen and mark the rest as not assessable. Never guess to
   fill a gap.

5. SETTINGS
   Temperature 0. API keys server-side only — never in the browser, never in
   the code, never in a screenshot.

HOW TO WORK WITH ME
- First write a one-page plan: what it does, the rubric with its weights, and
  what it must never do. Show me. Wait for my go.
- Then build in small steps. After each step, explain in plain words what you
  just did and why it matters.
- Before any big decision, give me the options and your recommendation.
- If I ask for something that breaks the rules above, tell me why it is a bad
  idea before you do it.
- Warn me before anything costs money.

Start with the plan. Only the plan.
```

---

## Why it is shaped like that

Every rule above exists because the obvious version fails.

**Why three stages?** Ask one AI to "look at this and score it" and it invents
numbers, flatters you, and gives a different answer every time. Split the job
and each part becomes simple and checkable.

**Why does code do the scoring?** So the score cannot drift. An AI in a
different mood gives a different number. Code does not have moods. This is what
makes a rating feel like a measurement instead of an opinion.

**Why check the answer?** Because asking nicely does not work. The AI will
agree to every rule and then break one. A prompt is a request. A check in code
is a guarantee.

**Why plan first?** You catch a wrong turn in thirty seconds instead of after
it has built the wrong app.

**Why "warn me before anything costs money"?** Because AI calls are billed to
you, and nobody enjoys finding that out afterwards.

## After the plan

Say **"go"** and let it build. Then:

```
Show me one worked example, start to finish. Then show me what happens when
the input is bad.
```

If the bad-input case invents an answer instead of refusing, the pipeline is
wrong. Send it back.

## You will need an API key

The app this builds has to talk to an AI model, and that runs on your key.
Cents per run. [Get one here](https://console.anthropic.com/settings/keys).

Building it is free. Running it is not.

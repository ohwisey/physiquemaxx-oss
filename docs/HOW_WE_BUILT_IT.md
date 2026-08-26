# How We Built It

A private physique tracker. Built in about a day. One person driving an AI coding agent.

This is the exact path we took, in order. Copy it. Swap the subject for anything.

---

## 1. Plan with pictures, not words

We pulled inspiration first. Reference images, a few app videos, screenshots of looks we liked. We dropped them into Canva and arranged the screens we wanted. No code yet. Just "this is what it should feel like."

**Lesson:** decide the feel before the build. Images move faster than paragraphs.

## 2. Send one master prompt

We wrote a single prompt describing the whole app and handed it to the AI. What it is, who it is for, the stack, and the rules it must never break.

The full prompt is in [THE_MASTER_PROMPT.md](THE_MASTER_PROMPT.md). Steal it.

**Lesson:** one clear brief beats fifty small asks. Name what it is NOT.

## 3. Let it write the spec, then build from the spec

The master prompt did not jump to code. First it wrote the spec: the product brief, the scoring rules, the design. Then it built from that.

When two notes disagreed, the brief won. One source of truth.

**Lesson:** make the AI write its own plan first. Read the plan. Then let it build.

## 4. Have the AI find and fix its own bugs

We did not trust the first version. We told the AI to hunt its own bugs and fix them. It caught real ones: history that overwrote itself, a phone layout that overlapped, a broken style build.

**Lesson:** a pass that only looks for what is wrong is worth more than more features.

## 5. Add Supabase for photos and sync

We added a hosted backend: Supabase. Login, database, and private photo storage in one place. No servers to run.

You shoot on your phone, the photos upload, and any device sees them. That is the sync. It is a web app you open in the phone browser, not a native app.

Photos live in a private bucket. Links expire. Row-level security on every table, so a stranger sees nothing.

One honest note: we reused a Supabase project we already had. **You make your own.** It is free to start and takes about five minutes.

**Lesson:** do not run servers. Use a hosted backend and lock down who sees what on day one. Test it with a stranger account. If the stranger sees a row, you are not done.

## 6. Build the pipeline that does not lie

The heart is the analysis, and it is where most AI apps fail. The trap is asking one AI to "look and score." It makes up numbers.

So we split it in three:

- **See:** the AI only describes the photos.
- **Score:** plain code grades it against a fixed rubric, same result every time.
- **Narrate:** the AI writes the words from the numbers, and cannot invent new ones.

Full detail and the real prompts are in [PROMPTS.md](PROMPTS.md).

**Lesson:** let AI see and talk. Never let it be the judge. Put the math in code, where it cannot drift.

## 7. Test, then ship to Vercel and GitHub

We tested it. Logged in as a stranger to confirm nobody could see private photos. Ran one real analysis end to end. Then we pushed to GitHub and deployed on Vercel. Secrets go in Vercel's settings, never in the code.

**Lesson:** test the live URL before you call it done.

---

## The one honest catch: the AI costs money

Every analysis is a paid Claude call. There is no free Claude key. You bring your own and pay cents per run. If you want zero cost, swap to a free vision tier (see the README). We tell people this up front. No surprises. That is the difference between a real tool and a bait.

## The whole thing in one breath

Plan in pictures. One master prompt. Let it spec, then build. Make it fix its own bugs. Add a hosted backend and lock it down. Split the AI three ways. Test with a stranger, then ship.

One day. One driver. One clear brief.

Now build yours.

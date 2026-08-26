# The Master Prompt

The whole app started from one prompt. This is it, cleaned up so you can reuse it.

Paste it into an AI coding agent. One prompt gets you most of the app in a single shot. Then you finish with a few passes: fix bugs, add your own Supabase, deploy. The full path is in [HOW_WE_BUILT_IT.md](HOW_WE_BUILT_IT.md).

Swap "physique" for anything you want to score. The shape holds.

---

Build a private physique-tracking web app.

**Product**
- Two users, private. Not a social app.
- A check-in is up to 4 standard photos: front, back, left, right.
- The app scores the physique, names the muscles holding it back, and gives a short plan.
- Voice: direct, evidence-based. No hype. No compliment sandwich.

**Stack**
- Next.js, App Router, TypeScript.
- Supabase for auth, database, and private photo storage.
- Row-level security on every table. Photos in a private bucket with signed, expiring links.
- Anthropic Claude for vision, server-side only, never expose the key.
- Deploy on Vercel.

**The AI must run in 3 stages, never one call**
1. See. The model reports only what is visible in the photos, as strict JSON. No scores.
2. Score. Plain code grades the evidence against a fixed rubric at temperature 0. Same input, same score.
3. Narrate. The model writes the words from the scores only. It may not invent a number or a muscle.

**Hard rules**
- Never invent a score, a body-fat number, or criticism to sound tough.
- Validate every AI reply against a schema. Retry once, then fail clean.
- Never make a photo public.
- Keys live in environment variables, never in the code.

**UI**
- A cinematic vertical card deck. One check-in per card, newest on top, the front photo as the cover.
- Tap a card to open the analysis: big score, the main weak point, the verdict, the muscle list, the plan.
- One hero per screen. Let the photo lead. Keep text small.

**Finish**
- Write a one-page spec first, then build from it.
- Find and fix your own bugs before calling it done.
- Test with a stranger account: they must see nothing.
- Ship to GitHub and Vercel.

---

One prompt does not one-shot a perfect app. It gets you the spine fast. The finishing is in the next doc.

# physiquemaxx-oss

An AI physique tracker, built in a day. 4 photos in, muscle-by-muscle rating out.

You upload front, back, left, right. It scores development, proportion, symmetry and conditioning, then writes you a short, honest read.

**Never written code?** Read [START_HERE.md](START_HERE.md) instead. Two
prompts you paste into Claude Code or Codex: one explains this whole codebase in
plain words, the other sets it up for you step by step.

> ## You need your own API key
>
> The rating is done by Claude's vision model, and that costs money. There is no
> shared server here and nobody is paying for you — you bring your own key.
>
> **It is cheap.** A scan costs cents, not dollars.
>
> **Get a key:** [console.anthropic.com](https://console.anthropic.com/settings/keys)
> — takes about two minutes.
> Current rates: [anthropic.com/pricing](https://www.anthropic.com/pricing).
>
> Without a key everything installs and opens fine, but the analyse button will
> not work.

## Two ways to have it

1. **Take the code.** Clone this repo, follow Setup, deploy your own copy.
2. **Build your own from one prompt.** Paste [docs/STARTER_PROMPT.md](docs/STARTER_PROMPT.md) into an AI coding agent. Fill in one blank and it builds *your* idea using the architecture that made this one work, explaining itself as it goes. (The original prompt behind this exact app is in [docs/THE_MASTER_PROMPT.md](docs/THE_MASTER_PROMPT.md).)

Either way it is yours. Change it, rebrand it, ship it.

## The idea worth stealing

The hard part of AI is that it wanders. Ask the same question twice, get two answers. This repo fixes that with a 3-stage pattern.

**1. See.** The vision model only looks. It reports what is visible in each photo: which muscles show, how clear the shot is, how confident it is. No scores. No opinions. Just evidence.

**2. Score.** Plain code, no AI, takes that evidence and grades it against a fixed rubric at temperature 0. Same evidence in, same numbers out. Every time. The scoring lives in `src/lib/analysis/scoring.ts` and the rubric it grades against lives in `src/lib/analysis/rubric.ts`.

**3. Narrate.** The model comes back only to write the words. It can talk about the muscles the code already flagged. It cannot invent new numbers or new criticism.

Why this matters: the model never gets to make up a score. Looking and talking are creative, so a model does them. Judging must be repeatable, so code does it. That is the whole trick. Your ratings stop drifting.

The exact prompts are in [docs/PROMPTS.md](docs/PROMPTS.md).

## Tech

- Next.js
- Supabase (auth, database, photo storage)
- Anthropic Claude vision
- Vercel (hosting)

## Setup

You do not need to be a developer. Copy, paste, done.

**1. Deploy to Vercel.** Click the button. It makes your own copy.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

**2. Make your own free Supabase.** Sign up at supabase.com, create a project. Open the SQL editor. Run each file in `/supabase/migrations` in order, top to bottom. That builds your database.

**3. Get your own Anthropic API key.** Sign up at console.anthropic.com and create a key. This powers the analysis.

**4. Paste the env vars into Vercel.** Copy `.env.example`, fill it in, and add the same values in your Vercel project under Settings, Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
ANTHROPIC_API_KEY
```

The Supabase values are in your Supabase project settings. The Anthropic one is the key from step 3.

**5. Open your URL.** Vercel gives you a link. That is your app.

## Cost warning

Read this before you start.

Every analysis is a paid Claude vision call on **your own** Anthropic key. Four photos go to the model twice per run. That costs real money from your Anthropic account.

No key, no analysis. The button that scores your photos will not work until you add a key.

This is a codebase, not a hosted app. There is no shared server. Nobody is paying for you. You run your own copy on your own keys.

## Free option (not tested yet)

Claude gives the best reads. It costs cents per analysis on your own key.

The code also supports Google Gemini, which has a free tier
([aistudio.google.com](https://aistudio.google.com)). Set these instead of the
Anthropic pair:

```
AI_PROVIDER=google
GOOGLE_API_KEY=your-key
GOOGLE_MODEL=gemini-2.5-flash
```

Be straight with yourself about this path: it is wired up and it compiles, but
nobody has run a real analysis through it and checked the answer against
Claude. It might be fine. It might quietly be worse. Free tiers also cap how
many requests you get per day, and Google renames models often.

If you try it, run the same four photos through both and see whether they pick
the same weak muscle. Claude is the tested default.

## License

MIT. Use it, change it, ship it.

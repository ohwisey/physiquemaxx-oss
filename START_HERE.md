# Start here

For people who have never written code.

You do not read this codebase. You **ask it questions**, and an AI coding agent
reads it for you and explains it in plain words.

One prompt does the whole rundown. It is below.

---

## What you need

- This code on your computer.
- An AI coding agent. **Claude Code** or **Codex** both work.

That is it.

## Get the code

1. On the repo page, click the green **Code** button.
2. Click **Download ZIP**.
3. Unzip it. You now have a folder.

## Open it with your agent

Open a terminal in that folder and start your agent there. Claude Code:

```
claude
```

It can now see every file.

---

## The one prompt

Paste this. It gives you the full rundown, start to finish.

It says nothing about this app in particular, so **it works on any codebase** —
save it and reuse it on the next repo you want to understand.

```
Read this entire codebase, then teach it to me. I have never written code, so
use plain words and skip the jargon. Go through all seven parts in order, and
at the end of each part ask if I want more detail before you move on.

1. WHAT IT IS
   What does this app do, who is it for, and what problem does it solve?

2. THE WALKTHROUGH
   Follow one real use of the app, from the first thing a person does to the
   last thing they see. Tell me what happens at each step and which file does
   it.

3. THE IDEA WORTH STEALING
   What is the smartest or least obvious decision in this codebase? Why was it
   built that way, and what would go wrong if it were built the ordinary way?

4. THE MAP
   List only the folders and files that actually matter, one line each. Skip
   config and boilerplate. Then tell me the three files to look at first.

5. THE GUARDRAILS
   Where does this code stop things going wrong: bad input, errors, made-up AI
   output, security, someone seeing data they should not? Show me the exact
   checks.

6. RUNNING IT MYSELF
   What do I need to get this running: accounts, keys, setup steps? Number the
   steps. Tell me plainly which parts cost money and roughly how much.

7. MAKING IT MINE
   Give me five things I could change, easiest to hardest, and name the file
   for each.

Then ask me what I want to do first.
```

Read the answer. When something is unclear, say **"explain that simpler"**. It
always works.

## The other one prompt: set it up

Want it running instead of explained? Paste this one. It walks you through the
whole setup, one step at a time, and waits for you at every step.

```
You are setting this app up for me. I have never written code.

How you must work:
- One step at a time. Never give me more than one thing to do at once.
- After each step, stop and wait for me to say done.
- Tell me exactly what to click and what to type. Assume I know nothing.
- If I paste an error, fix it and tell me the next thing to do.
- Never assume I already have an account. Walk me through making it.
- Warn me before anything costs money.

Do these in order:
1. Check my computer has what it needs. Tell me what to install if it does not.
2. Get the app running on my own computer first, so I can see it works before
   I set anything else up.
3. Walk me through making a free Supabase account and project.
4. Set up the database. Tell me exactly what to copy and where to paste it.
5. Walk me through getting an API key, and tell me what it will cost.
6. Put every key in the right place for me.
7. Test it with me, end to end: a real login and a real check-in.
8. Put it online with Vercel so I can use it on my phone.

Start with step 1. Only step 1.
```

This one is generic too. It works on any repo that has a README.

## After the rundown

Whatever you want to do next, just say it plainly:

```
Walk me through setting this up. I have never used Supabase or Vercel. Ask me
one question at a time and wait for my answer.
```

```
I want to change this so it rates [your thing] instead. Tell me every file
that needs changing, then help me do them one at a time.
```

```
Add this: [describe it in your own words]. Before writing any code, show me
your plan and wait for me to say go.
```

Always make it show a plan first. You catch a wrong turn in thirty seconds
instead of after it has built the wrong thing.

When something breaks, paste the error straight in. Do not try to understand it
first. If a fix does not work, say so plainly: "that did not work, here is what
happened."

---

## How long this takes

| What you want | Roughly |
|---|---|
| The full rundown above | 10 minutes |
| Your own copy running | 20 minutes, mostly signups |
| Really understand it | An evening of asking questions |
| Rebrand it: name, colours, wording | An hour or two |
| Point it at something else to rate | A few hours |
| Build a whole new app on this pattern | A day |

The last one is not a guess. That is how long this app took.

## Where to go next

- [docs/HOW_WE_BUILT_IT.md](docs/HOW_WE_BUILT_IT.md) — the steps we took, in order.
- [docs/PROMPTS.md](docs/PROMPTS.md) — the real prompts, and why they are shaped that way.
- [docs/STARTER_PROMPT.md](docs/STARTER_PROMPT.md) — one prompt that builds *your* idea using this architecture, and teaches you the pattern while it does.
- [docs/THE_MASTER_PROMPT.md](docs/THE_MASTER_PROMPT.md) — the original prompt behind this exact app.

## One honest warning

Reading the code, running the app and changing it are all free. Only the rating
costs money — it runs on your own Claude key, cents per scan. See the key
notice at the top of the [README](README.md).

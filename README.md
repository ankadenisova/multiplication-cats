# Multiplication Cats

A website where a kid practises the times tables and earns cat stickers and phone time for it. A session is 10 problems; a finished session gives a sticker and 15 minutes of screen time, and after 5 sessions a day only the sticker. After every counted session a Telegram bot tells the parents: "finished a session, add 15 minutes".

How it came about: [origin story, in Russian](https://t.me/denisova_pt/1367).

It is built on an app by Alex Pisarevsky ([alexpihq](https://github.com/alexpihq)), published here with his permission. I turned it into a website and redrew the design.

## Make your own

Give the link to this repository to your coding agent (Claude Code, Codex) and tell it what to change: the kid's name, the rewards, the problems, the design, the language. Two UI languages are built in, English and Russian; switch with `APP_LOCALE` in `.env`. The agent can add any other language the same way (one file in `src/lib/i18n/`).

You will need free accounts on Neon (database) and Vercel (hosting). The agent sets everything up and tells you where to sign in.

Settings are in `.env.example`. How the site works is in [docs/architecture.md](docs/architecture.md).

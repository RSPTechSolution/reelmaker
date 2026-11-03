# Reel Maker

Local app that turns a topic into an animated Hinglish reel (1080×1920, 30 fps), with Claude Code as the agent.

## Windows setup

Install these first:

1. **Node.js 22.18 or newer** — LTS installer from https://nodejs.org. Scripts run TypeScript using Node's built-in type stripping, so Node 20 is not enough.
2. **Python 3.12** — from https://www.python.org/downloads/. Tick **"Add python.exe to PATH"** in the installer. Kokoro does not support 3.13+. Other Python versions can stay installed; setup uses `py -3.12`.
3. **espeak-ng** — download the `.msi` from https://github.com/espeak-ng/espeak-ng/releases and run it. Kokoro needs it to speak Hindi.
4. **Claude Code** — install it, then run `claude` once in a terminal and log in.

Then, in this folder:

```
npm run doctor   # checks the four tools above and says what to install
npm run setup    # npm install, Python venv, model downloads, default brand/mascot
```

`npm run setup` downloads Kokoro and whisper `small` on the first run (a few hundred MB).

## Scripts

| Command | What it does |
|---|---|
| `npm run doctor` | Prints a tool table; exits 1 if anything is missing |
| `npm run setup` | One-time install |
| `npm run dev` | Starts the server and web app |
| `npm test` | Runs the tests |
| `npm run typecheck` | Type-checks the TypeScript |

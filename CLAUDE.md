# Reel Maker

Local single-user app that turns a topic into an animated Hinglish reel (1080×1920, 30 fps).

- Spec: `docs/superpowers/specs/2026-11-03-reelmaker-design.md`
- Plan: `docs/superpowers/plans/2026-11-03-reelmaker.md` — build it task by task, in order, ticking checkboxes as you go.

## Rules for building
- Target machine is **Windows, i5, 16 GB RAM, no GPU**. Use Windows-safe paths and spawn processes with argument arrays.
- Follow the plan's Interfaces blocks exactly (names, types, file paths). If you must deviate, update the plan file in the same commit and say why.
- Test first: write the failing test, run it, implement, run again, commit. One commit per task.
- Pin all `remotion` / `@remotion/*` packages to the same exact version.
- Never add paid APIs or cloud services.
- Stop and ask me before: changing the reel schema beyond the plan, adding a new dependency not listed in the plan, or skipping a test.

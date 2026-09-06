# skills-atlas

A curated catalogue of agent skills. Not an installer — a review site:
which skills are worth using, why, and when not to.

**Planned URL (not yet published):** https://peterlwkww-ai.github.io/skills-atlas/
— nothing has been deployed yet; the Pages workflow exists but the one-time
"Settings → Pages → Source: GitHub Actions" step hasn't been done.

## Data model

Two separate stores that are joined at build time:

- `src/data/registry.json` — skill facts. **Hand-maintained for now** (subproject 1
  targets 10 curated skills; 5 are currently in the registry, written by hand per spec §5.5) — hand-editing is
  currently the only way to add a skill. It will become machine-generated once
  the subproject 2 importer (scanning installed `SKILL.md` files) lands; at
  that point it goes back to **never edit by hand.**
- `src/content/notes/*.md` — hand-written opinions. **Never touched by scripts.**

They join on the `skill:` field in each note's frontmatter.

## Commands

    npm run dev          # local dev server
    npm run validate     # data validation only
    npm run build        # validate, then build to dist/
    npm test             # unit tests for the validator
    npm run test:smoke   # assertions against a built dist/
    npm run check-links  # verify sourceUrl values (manual, not in CI)

## Related

Sibling project: [Superpowers Guide](https://github.com/peterlwkww-ai/Superpowers-guide)
— a scenario walkthrough for the superpowers plugin specifically.

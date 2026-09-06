# skill-atlas

A curated catalogue of agent skills. Not an installer — a review site:
which skills are worth using, why, and when not to.

**Live:** https://peterlwkww-ai.github.io/skill-atlas/

## Data model

Two separate stores that are joined at build time:

- `src/data/registry.json` — machine-generated skill facts. **Never edit by hand.**
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

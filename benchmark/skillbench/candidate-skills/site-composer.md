---
name: site-composer
description: >
  Spin up a unique, polished customer site end to end on the Website Engine v2 rail —
  business facts in, gated live preview out. Use whenever an issue asks you to build,
  compose, demo or preview a site for a named business (a prospect demo, a client site,
  a pitch mock). Covers the one command that does it, the single design decision you are
  allowed to make, the gates that must pass, and the four things that will get a spin-up
  rejected. Do NOT hand-author HTML, CSS, a template file or a page component for a
  customer site — the engine owns every design decision and hand-authored pages break
  the uniqueness guarantee.
---

# Site Composer

You do not design customer sites. You describe the business; the engine composes the
site. That asymmetry is the product: an agent that picked palettes would pick badly,
and two agents would pick differently for the same business.

Repo: `sites/website-studio`. Owner: FoundingEngineer.

## The whole rail is one command

```bash
cd sites/website-studio

# Dry run — see the composition, claim nothing.
npm run spinup -- --slug acme-roofing --name "Acme Roofing" --register corporate --kind roofing

# Build it: claims the fingerprint, registers the record, builds, runs the gates.
npm run spinup -- --slug acme-roofing --name "Acme Roofing" --register corporate --kind roofing --commit

# Publish it: everything above, then deploy and poll the edge until it serves 200.
npm run spinup -- --slug acme-roofing --name "Acme Roofing" --register corporate --kind roofing --deploy
```

Preview lands at `https://preview.thinkstack.ie/v2/<slug>/`. The estate is whole-estate
noindex, so a demo can never compete with the real business in search.

Never run the steps by hand. There is no step where you edit a source file to add a
site — if you find yourself opening `records.mjs`, you are off the rail.

## The one decision you make: `--register`

`--register` is a **judgement about the business, not about design**. Everything
downstream — template, section order, variants, type pairing, palette, density — is
derived from it plus the slug.

| Register | Use for |
|---|---|
| `corporate` | professional services, trades, contractors, clinics |
| `technical` | software, data, infrastructure, B2B SaaS |
| `craft` | makers, food, small-batch product, artisans |
| `editorial` | studios, agencies, photographers, anything selling taste |

`--kind` is free text (`roofing`, `accountancy`, `consultancy`) and only breaks the
archetype tie for `corporate` and `technical`. Do not agonise over it.

Everything else is optional and you usually want none of it: `--template` forces a base
template and skips auto-pick, `--density` overrides spacing, `--gallery` unlocks the
gallery-forward template.

## Four things that get a spin-up rejected

1. **Invented proof.** Never pass or write testimonials, review counts, metrics,
   certifications or customer numbers the operator did not supply. The engine renders a
   *labelled placeholder* instead, and `G-HONEST` greps the built HTML for the exact
   strings a previous incident shipped ("— Happy customer"). A demo that invents a
   five-star review is a liability, not a better demo.
2. **`--gallery` without real client imagery.** Gallery-forward is image-density-as-
   argument. Without real photography it is the worst of the six templates, not the best.
   Only pass `--gallery` when the operator has actually handed you images.
3. **Changing a live site's slug.** The slug seeds the entire composition. Change it and
   the prospect's site silently re-brands — they have already seen the old one. Treat the
   slug as immutable after launch. If the rail warns that a slug is registered with a
   different composition, stop and ask before committing.
4. **Hand-authored pages.** A bespoke HTML/CSS page for one customer is invisible to the
   uniqueness registry, so the next spin-up can duplicate it. Six templates × the axis
   space is ~8.3e7 reachable compositions; you do not need a seventh template.

## The gates are the definition of done

`--commit` and `--deploy` run them for you and abort on failure. A spin-up is done when
they pass, not when the page looks right in a browser.

`G-MANDATORY` no page drops a tier-1 block · `G-REGISTER` pairing never escapes its
register · `G-DETERMINISM` same record in, same composition out · `G-UNIQ` no two sites
share a fingerprint · `G-SPREAD` uniqueness is structural, not cosmetic · `G-PIN` pick
order has not drifted · `G-RENDER` the built DOM matches the composition · `G-HONEST` no
invented proof.

Run them any time: `npm run gate:compose` (~0.1s, browserless, no network).

If a gate fails, **read what it says and fix the cause** — do not re-run hoping for a
different result, and never edit `compositions.json` or `pins.json` to make a gate pass.
Those two files are the uniqueness guarantee; hand-editing them is how the estate starts
shipping duplicate layouts. `G-PIN` failing means someone changed the composer's pick
order and every existing site would re-brand — that is a product decision, escalate it.

## Reporting a spin-up

Give the issue the live URL, the register you chose and why, the template the engine
picked, and the fingerprint. The fingerprint is what makes "this site is unique" a
checkable claim rather than a promise.

Deeper background — why the templates differ on argument order, how collision advance
works, how to change the composer safely: `src/v2/compose/README.md`.

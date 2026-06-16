# ThinkStack brand assets

In-app ThinkStack logo, served at `/brands/…` for use **within Paperclip**.
These are inline-faithful **recreations** of the mark (built to render crisply in
the app across sizes and themes), not the master artwork.

> **Use inside Paperclip only.** For anything outside Paperclip — print,
> external sites, decks, email signatures, app-store icons, etc. — use the
> original official ThinkStack files, not these recreations.

For in-app React usage prefer the `ThinkStackLogo` / `ThinkStackWordmark`
components (`ui/src/components/ThinkStackLogo.tsx`) — same artwork, inline and
theme-aware. These SVGs exist mainly as a frame of reference and for the few
in-app spots that need a static URL.

| File | Variant | Use on |
|------|---------|--------|
| `thinkstack-mark.svg` | mark, **light/primary** (white channels, transparent) | light surfaces |
| `thinkstack-mark-dark.svg` | mark, dark (black tile, black channels) | dark surfaces / dark mode |
| `thinkstack-wordmark.svg` | lockup, light (dark wordmark) | light surfaces |
| `thinkstack-wordmark-dark.svg` | lockup, dark (white wordmark) | dark surfaces / dark mode |

The light variants are the default; the dark (black) variants are for dark mode
or wherever they suit the layout better.

**Brand gradient:** `#e85d4a → #f5a623 → #f7d038 → #5cb85c` (red→orange→yellow→green),
also exposed as the `--ts-gradient` / `--ts-*` tokens in `ui/src/index.css`.

**Wordmark font:** the lockup SVGs use a bold geometric sans stack
(Poppins → Inter → system) as a stand-in — another reason these are in-app only;
the official wordmark uses the licensed brand face.

**Per-company branding:** companies building their own brand don't have to use
this mark — set a company `logoUrl` and/or `brandColor` (Company settings) and
`CompanyPatternIcon` will render their logo/colour instead of the generated
prefix tile. This ThinkStack mark is the house default and frame of reference.

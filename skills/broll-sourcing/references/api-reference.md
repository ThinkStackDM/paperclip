# Stock/CC API reference — exact REST patterns

All examples use `curl` + `jq`. Keys come from env vars; never hardcode keys in
issues, commits, or manifests. Always record the asset's *page* URL (not just the
file URL) in the manifest — that is the licence evidence.

## Pexels (`PEXELS_API_KEY`)

Free key: https://www.pexels.com/api/ — auth is the raw key in the `Authorization`
header. Limits ~200 requests/hour, 20,000/month.

```bash
# Photo search
curl -s -H "Authorization: $PEXELS_API_KEY" \
  "https://api.pexels.com/v1/search?query=city%20skyline&orientation=landscape&size=large&per_page=5" \
  | jq '.photos[] | {id, url, photographer, src: .src.large2x}'

# Video search (b-roll)
curl -s -H "Authorization: $PEXELS_API_KEY" \
  "https://api.pexels.com/videos/search?query=city%20skyline%20timelapse&orientation=landscape&per_page=5" \
  | jq '.videos[] | {id, url, user: .user.name,
        files: [.video_files[] | select(.height>=1080) | {link, width, height, fps}]}'

# Download: pick a video_files[].link, save as pexels-<id>.mp4
```

Licence (https://www.pexels.com/license/): free for commercial use, modification
allowed, no attribution required. Prohibited: selling unmodified copies, implying
endorsement by identifiable people or brands, redistributing as stock.
Manifest: `licence: "Pexels License"`, `attribution_required: false`, author =
`photographer` / `user.name`.

## Pixabay (`PIXABAY_API_KEY`)

Free key: https://pixabay.com/api/docs/ — key is a query parameter. Limit ~100
requests/minute; Pixabay asks you to cache results (download, don't hotlink).

```bash
# Images
curl -s "https://pixabay.com/api/?key=$PIXABAY_API_KEY&q=city+skyline&image_type=photo&orientation=horizontal&min_width=1920&safesearch=true&per_page=5" \
  | jq '.hits[] | {id, pageURL, user, largeImageURL}'

# Videos
curl -s "https://pixabay.com/api/videos/?key=$PIXABAY_API_KEY&q=city+skyline&per_page=5" \
  | jq '.hits[] | {id, pageURL, user, files: .videos | {large: .large.url, medium: .medium.url}}'

# Music (audio beds) — Pixabay music is exposed on the site; the public API covers
# images/videos. For beds, download manually from pixabay.com/music/ and record the
# page URL + "Pixabay Content License" in the manifest.
```

Licence (https://pixabay.com/service/license-summary/): Pixabay Content License —
free commercial use, modification allowed, no attribution required. Prohibited:
standalone redistribution or sale of unmodified content.
Manifest: `licence: "Pixabay Content License"`, `attribution_required: false`.

## Openverse (no key)

CC/public-domain index (images + audio). Anonymous use is rate-limited — register
at https://api.openverse.org/ for higher limits if you see 429s.

```bash
# ALWAYS filter to commercial+modification for portfolio work
curl -s "https://api.openverse.org/v1/images/?q=city%20skyline&license_type=commercial,modification&page_size=5" \
  | jq '.results[] | {id, title, url, foreign_landing_url, license, license_version, creator, attribution}'

# Audio:
curl -s "https://api.openverse.org/v1/audio/?q=ambient&license_type=commercial,modification&page_size=5" \
  | jq '.results[] | {id, title, url, foreign_landing_url, license, creator, attribution}'
```

The response's `attribution` field is a ready-made attribution line — copy it into
the manifest verbatim. `foreign_landing_url` is the source page; spot-check it (the
index is occasionally stale on licence). Manifest: `licence: "CC <license>
<license_version>"`, `attribution_required: true` for BY/BY-SA.

## Wikimedia Commons (no key; descriptive User-Agent required)

```bash
curl -s -H "User-Agent: thinkstack-broll/1.0 (davin@thinkstack.ie)" \
  "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=city%20skyline&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url%7Cextmetadata" \
  | jq '.query.pages[] | {title,
        url: .imageinfo[0].url,
        page: .imageinfo[0].descriptionurl,
        licence: .imageinfo[0].extmetadata.LicenseShortName.value,
        author: .imageinfo[0].extmetadata.Artist.value}'
```

Licence varies PER FILE — read `extmetadata.LicenseShortName` and reject anything
NC/ND or "Fair use". CC BY / BY-SA require attribution: build the line as
`"<Author>, <LicenseShortName>, via Wikimedia Commons, <descriptionurl>"` and store
it as `attribution_text`. BY-SA also means derivatives of the *asset itself* carry
the licence — fine for b-roll inside a larger video, but record it.

## NASA image and video library (no key)

```bash
curl -s "https://images-api.nasa.gov/search?q=earth%20from%20orbit&media_type=video" \
  | jq '.collection.items[:5][] | {nasa_id: .data[0].nasa_id, title: .data[0].title, href}'

# The item's collection.json at .href lists downloadable renditions (mp4 sizes):
curl -s "<href>" | jq '.[]'
```

NASA media is generally US public domain; check the item description for third-party
material (music, footage from partners) before use. Manifest:
`licence: "Public Domain (NASA)"`, courtesy `attribution_text: "Video: NASA"`.

## coverr.co (manual)

No public API key flow — browse https://coverr.co, download manually, record the
clip page URL. Licence: https://coverr.co/license — free for commercial use, no
attribution required. Manifest: `licence: "Coverr License"`.

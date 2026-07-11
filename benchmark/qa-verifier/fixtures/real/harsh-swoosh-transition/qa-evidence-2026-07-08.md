# TSM-5333 QA evidence

Automated checks completed

- Gate suite overall pass: `True`
- TSM-5333 Cashflow Compass AV review proxy: pass=`True`
- TSM-5333 Stack Lab AV review proxy: pass=`True`
- TSM-5333 Jessica and James AV review proxy: pass=`True`
- TSM-5333 Vault Cases AV A/B review pack: pass=`True`

Human self-listen requirement

- Required by operator and issue scope: every staged file must be heard end-to-end before review-path upload.
- This Codex heartbeat can generate, inspect metadata, and run the `B-audio` gate suite, but it cannot truthfully claim a human ear-listen happened inside the terminal environment.
- Result: the fresh pack exists and mechanically passes, but restage/upload remains blocked until a named audio-capable owner listens to each staged file end-to-end and records the pass/fail evidence here.

Files awaiting that listen pass
- `/Users/glad0s/.paperclip/instances/default/companies/d71c9e82-1a4b-497f-9bbc-5b9dd028c367/work-products/TSM-5333/rendered-av/cc-sample.mp4` | voice `Kore` | duration `30.0`s | sha256 `cab41dfb58f78be766f099c035fe792e666d3087cb596112896040700ce6b58f` | listener `TBD`
- `/Users/glad0s/.paperclip/instances/default/companies/d71c9e82-1a4b-497f-9bbc-5b9dd028c367/work-products/TSM-5333/rendered-av/jj-sample.mp4` | voice `Aoede` | duration `30.0`s | sha256 `bb099be4b77bae83c14e01270f9d9593b67b5870f0ad82b81dd5ec9fbd54d516` | listener `TBD`
- `/Users/glad0s/.paperclip/instances/default/companies/d71c9e82-1a4b-497f-9bbc-5b9dd028c367/work-products/TSM-5333/rendered-av/sl-sample.mp4` | voice `Charon` | duration `30.0`s | sha256 `6f1e600f5c36ab9433db32dce3176b7a242b8e0fb5572f821d66f2beb2204d07` | listener `TBD`
- `/Users/glad0s/.paperclip/instances/default/companies/d71c9e82-1a4b-497f-9bbc-5b9dd028c367/work-products/TSM-5333/rendered-av/vca-sample.mp4` | voice `Orus` | duration `30.0`s | sha256 `ffa93919b5a5af14e91c204b3341873abaa98028b2737378870cfd34bfb91f54` | listener `TBD`
- `/Users/glad0s/.paperclip/instances/default/companies/d71c9e82-1a4b-497f-9bbc-5b9dd028c367/work-products/TSM-5333/rendered-av/vcb-sample.mp4` | voice `Orus` | duration `30.0`s | sha256 `e86824f027acbbd589d257d5b2e83b1cbe31d879de33b40f932f3f973ccf025c` | listener `TBD`

Next required action

- Audio-capable owner performs the mandatory listen pass against the five AV proxies plus the underlying voice/mix WAVs, records their name and timestamp, then TSM-5331 uploads the reviewed set and restores operator review.

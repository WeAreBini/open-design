# Bini Improve Prompt client (hosted)

`extensions/od-bini.js` is the composer **Improve prompt** control for WeAreBini hosted Open Design. It calls the volume route `POST /api/bini/improve-prompt` (Grok). It does not change Grok auth, `improve-prompt.js`, or the web-preview token route.

## Progress UX

While a request is in flight the control shows an `aria-live` status with honest stages:

1. Starting Improve Prompt…
2. Asking a clarifying question…
3. Writing the brief…

Elapsed time updates each second. The button stays disabled so a second click cannot start a parallel run.

## Install

Hosted entrypoint runs `bin/install-improve-prompt-client.sh` and re-asserts the file for a short window after boot so a volume `apply-bini-product` copy cannot leave an older silent client in place.

Ops can also copy the file onto the volume:

```text
/app/.od/extensions/od-bini.js
```

Then hard-refresh the browser (cache-bust `/od-bini.js?v=…` if needed).

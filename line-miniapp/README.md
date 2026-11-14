# rizz et al.

**Make your move. Cite your sources.**

A LINE MINI App / LIFF companion for writing short, flirty texts that reference a concrete idea from a real ML paper. Every suggestion has its own arXiv citation and an explanation of the connection. The interface includes speaker-labeled chat context, lowkey/playful/bold styles, research topics, copy/share actions, a paper library, and browser-local saved lines.

## Run

Requires Node.js 22.13 or later.

```sh
cd line-miniapp
npm ci
npm run dev
```

Open the Local URL printed by the server, normally http://127.0.0.1:5173. The sample conversations and crafted paper-specific examples work without credentials. Without an OpenAI key, examples are matched to topics and simple conversation cues; they are explicitly labeled and are not full AI personalization.

```sh
npm run check
npm run build
```

The production output is a Cloudflare Worker under `dist/server/` with client assets under `dist/client/`. Hosting infrastructure follows `.openai/hosting.json`. A hosting project ID is not configured yet.

## Connect LINE

The app cannot read LINE chat history. The intended flow is: select a few messages → forward text to the bot → tap Open app → label speakers → generate a reply. Forwarded messages do not preserve the original speakers, so labels must be confirmed in the app.

1. Sign in to the [LINE Developers Console](https://developers.line.biz/console/) with your regular LINE account and create a provider.
2. Create a LINE Official Account, enable its Messaging API, and keep its Messaging API channel under that provider.
3. Create a LINE Login channel with a LIFF app, or a LINE MINI App channel, under the **same provider**. Using the same provider ensures bot and LIFF user IDs match. Set the app endpoint to your deployed HTTPS URL and enable `openid`. Enable `profile` only if you need it. Register your own LINE account as a tester while developing.
4. Copy `.dev.vars.example` to `.dev.vars` and fill in the LINE values locally. `LIFF_CHANNEL_ID` is the Login/MINI App channel ID; `LINE_CHANNEL_SECRET` and `LINE_CHANNEL_ACCESS_TOKEN` belong to the **Messaging API** channel. `LIFF_ID` is the LIFF app ID. On production, configure these as runtime secrets.
5. Set the Messaging API webhook to `https://YOUR_HOST/api/line/webhook`, verify it, then enable webhooks. Disable the account's automatic canned reply to avoid duplicate responses.
6. Provision the `DB` D1 binding and apply the SQL files in `drizzle/` in order. The Sites deployment workflow applies hosted migrations; see below for local migrations.
7. Add the bot as a friend and forward text. `/open` returns the app link, `/clear` deletes shared context. Enable LIFF's share target picker if you want its optional Share action.

A custom domain is optional. The bot webhook and LIFF endpoint must be publicly reachable over HTTPS. An owner-private preview URL cannot serve as LINE's webhook.

## AI generation and references

Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (default `gpt-4.1-mini`). Calls use the Responses API, structured output, and `store: false`. Generated citation IDs are validated against the supplied real papers; arbitrary model-generated citations are rejected. The prompt requires a specific paper detail inside every sendable line, separates fact from metaphor, and discourages generic buzzword substitutions.

Paid AI generation is available to verified LINE sessions or authenticated private Sites visitors. For **local development only**, `ALLOW_ANONYMOUS_AI=true` also enables it in the ordinary browser preview. Keep that off for a public deployment. Verified LINE users are limited to ten AI requests per minute.

The built-in library contains verified arXiv papers. With AI enabled, the server can refresh relevant paper metadata through arXiv's public Atom API; it falls back to the reference library if arXiv is unavailable. Set `TAVILY_API_KEY` to discover more papers: Tavily searches arxiv.org for the topic, and the server fetches the metadata for the found IDs from arXiv, so citations still come from arXiv itself. Without the key, or if Tavily fails, the server uses the fixed arXiv title queries. Topic queries contain no chat text. In-process caching and request spacing limit repeated queries.

## Storage and privacy

- Browser-entered conversations live only in page memory. Saved lines use localStorage and contain only the selected reply and reference.
- LINE imports require server verification of the LIFF ID token and the expected channel ID. Client-provided user IDs are never trusted.
- Webhooks require an HMAC-SHA256 signature over the unmodified request body. Incoming text is deduplicated by LINE message ID and scoped to the sending user's one-on-one bot chat. Group messages are ignored.
- Only the latest twelve shared text messages are retained per user. Context is unavailable after 24 hours. Expired rows are physically pruned on subsequent webhook/context requests; there is no scheduled deletion job. `/clear`, clearing a loaded chat, blocking the bot, and unsending imported messages delete the corresponding stored content.
- The application does not send a generated pickup line automatically. Copying and LINE sharing are explicit user actions.

## Local database

Build once to emit the Wrangler configuration, then apply each migration once:

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_greedy_unus.sql
```

No LINE channel, OpenAI key, or deployment credentials are included in this repository. The existing Telegram project at the repository root is separate.

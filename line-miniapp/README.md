# rizz et al. — LINE mini app

The app behind [rizz et al.](../README.md): a Next.js app, built with vinext, that runs as a Cloudflare Worker and stores data in D1. This file covers running, configuring, and wiring it to LINE. The repository README explains what the app does and how it works.

## Run locally

Requires Node.js 22.13 or later.

```sh
npm ci
npm run dev
```

Open the Local URL that the dev server prints. The sample conversation and the crafted, paper-specific replies work without any credentials.

`npm run dev` signs you in as a local test user, so AI generation turns on as soon as `OPENAI_API_KEY` is set in `.dev.vars`.

```sh
npm run check   # TypeScript
npm run lint
npm run build   # Worker in dist/server/, client assets in dist/client/
npm start       # serves the production build with Wrangler, after npm run build
```

## Configuration

Copy `.dev.vars.example` to `.dev.vars` for local development. In production, set these as Worker secrets.

| Variable | Needed for | Notes |
| --- | --- | --- |
| `OPENAI_API_KEY` | AI-tailored replies | Without it, the app serves crafted example replies. |
| `OPENAI_MODEL` | AI-tailored replies | Defaults to `gpt-4.1-mini`. |
| `TAVILY_API_KEY` | Wider paper discovery | Without it, the server queries arXiv for a fixed set of titles per topic. |
| `LIFF_ID` | LINE | The LIFF app ID. |
| `LIFF_CHANNEL_ID` | LINE | The LINE Login or LINE MINI App channel ID, used to verify ID tokens. |
| `LINE_CHANNEL_SECRET` | LINE | Messaging API channel secret, used to verify webhook signatures. |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE | Messaging API channel access token, used for bot replies. |
| `LINE_BOT_BASIC_ID` | LINE | The bot's basic ID, used for the "add the LINE bot" link. |
| `ALLOW_ANONYMOUS_AI` | Local testing | `true` enables AI for visitors who are not signed in, such as under `npm start`. Keep it `false` on a public deployment. |

The Worker also needs a D1 binding named `DB` for LINE imports and rate limiting.

## Connect LINE

The app cannot read LINE chat history. Users forward the messages they want help with to the bot, open the app, label who said each message, and generate a reply. Forwarded messages lose their original sender, so speaker labels have to be set in the app.

1. Sign in to the [LINE Developers Console](https://developers.line.biz/console/) and create a provider.
2. Create a LINE Official Account, enable its Messaging API, and keep that Messaging API channel under the provider.
3. Under the **same provider**, create a LINE Login channel with a LIFF app, or a LINE MINI App channel. A shared provider makes bot and LIFF user IDs match. Set the endpoint to the deployed HTTPS URL and enable the `openid` scope. While developing, register your LINE account as a tester.
4. Fill in the LINE variables above.
5. Set the Messaging API webhook URL to `https://YOUR_HOST/api/line/webhook`, verify it, and enable webhooks. Turn off the account's automatic greeting and auto-reply messages so users don't get duplicate replies.
6. Create the D1 database and apply the SQL files in `drizzle/` in order.
7. Add the bot as a friend and forward it some text. Enable LIFF's share target picker for the optional Share button.

The webhook and LIFF endpoint must be reachable over public HTTPS.

### Bot commands

| Command | Effect |
| --- | --- |
| `/open`, `/start`, `/help` | Replies with a button that opens the app. |
| `/clear`, `/reset` | Deletes your shared messages. |
| Any other text | Stores it as shared context; the first message in a 30-second burst gets an app link. |

## Local database

Build once to generate the Wrangler config, then apply each migration once:

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_greedy_unus.sql
```

## Storage and privacy

- Conversations typed in the browser stay in page memory. Saved lines go to `localStorage` and hold only the reply and its paper.
- `/api/context` verifies the LIFF ID token against `LIFF_CHANNEL_ID` with LINE before returning anything. It never trusts a user ID from the client.
- The webhook verifies LINE's HMAC-SHA256 signature over the raw body before parsing. It stores only one-on-one chats with the bot, ignores groups, and deduplicates by LINE message ID.
- Each user keeps at most the latest 12 shared messages, and they expire after 24 hours. Expired rows are deleted on the next webhook or context request. `/clear`, clearing a loaded chat in the app, blocking the bot, and unsending a message all delete the stored text.
- With AI on, the selected messages go to OpenAI with `store: false`. arXiv and Tavily receive only the research topic, never chat text.
- The app never sends a line for you. Copying and LINE sharing are explicit actions.

declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    LINE_CHANNEL_SECRET?: string;
    LINE_CHANNEL_ACCESS_TOKEN?: string;
    LIFF_ID?: string;
    LIFF_CHANNEL_ID?: string;
    LINE_BOT_BASIC_ID?: string;
    APP_URL?: string;
    ALLOW_ANONYMOUS_AI?: string;
  }
}

import type { Config } from "@react-router/dev/config";

// Static site on Cloudflare Pages: SPA mode, served from build/client. Without
// a 404.html, Pages answers unknown paths with index.html, so client routes work.
export default {
  ssr: false,
} satisfies Config;

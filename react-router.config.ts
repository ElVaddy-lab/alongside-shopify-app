import { vercelPreset } from "@vercel/react-router/vite";
import type { Config } from "@react-router/dev/config";

// Server-rendered admin; the Vercel preset maps routes to Vercel Functions.
// Locally (shopify app dev) the preset has no effect on the dev server.
export default {
  ssr: true,
  presets: [vercelPreset()],
} satisfies Config;

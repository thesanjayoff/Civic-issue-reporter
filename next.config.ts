import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Cache Components (PPR) is left off on purpose: almost every page here is
// location/user-specific (live DB queries, auth cookies, map bboxes), so
// there's little static shell to prerender and Suspense-boundary bookkeeping
// would mostly add ceremony rather than real caching wins for this app.
const nextConfig: NextConfig = {
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);

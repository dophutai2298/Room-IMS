import { createRefreshAuthRouter } from "@insforge/sdk/ssr";

import { getInsForgeConfig } from "@/lib/insforge/config";

export async function POST(request: Request) {
  const router = createRefreshAuthRouter(getInsForgeConfig());

  return router.POST(request);
}

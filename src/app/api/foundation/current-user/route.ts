import { ok } from "@/lib/insforge/errors";
import { withOperationalAuth } from "@/lib/server/operational-route";

export const dynamic = "force-dynamic";

export const GET = withOperationalAuth(
  { operation: "foundation.current-user" },
  ({ user }) => ok(user),
);

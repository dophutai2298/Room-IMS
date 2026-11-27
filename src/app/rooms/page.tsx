import { RoomsClient } from "./rooms-client";
import { getAppBackend } from "@/lib/backend/selection";

export const dynamic = "force-dynamic";

export default function RoomsPage() {
  return <RoomsClient isSupabaseFoundation={getAppBackend() === "supabase"} />;
}

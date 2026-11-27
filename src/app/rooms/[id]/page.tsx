import { RoomDetailClient } from "./room-detail-client";
import { getAppBackend } from "@/lib/backend/selection";

export default async function RoomDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <RoomDetailClient roomId={id} isSupabaseFoundation={getAppBackend() === "supabase"} />;
}

import { RoomDetailClient } from "./room-detail-client";

export default async function RoomDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <RoomDetailClient roomId={id} />;
}

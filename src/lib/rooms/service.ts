import "server-only";

import type { AppResult } from "@/lib/insforge/errors";
import type { RoomDetailView, RoomOperationsSummaryView } from "./presenter";
import type { RoomDetailRepository } from "./repository";

export async function getRoomDetailForOperations({
  repository,
  roomId,
}: {
  repository: RoomDetailRepository;
  roomId: string;
}): Promise<AppResult<RoomDetailView>> {
  return repository.readRoomDetail(roomId);
}

export async function getRoomOperationsSummaryForOperations({
  repository,
  roomId,
}: {
  repository: RoomDetailRepository;
  roomId: string;
}): Promise<AppResult<RoomOperationsSummaryView>> {
  return repository.readRoomOperationsSummary(roomId);
}

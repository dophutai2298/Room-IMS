import "server-only";

import type { AppResult } from "@/lib/insforge/errors";
import type { MvpSeededData, RoomRecord } from "@/lib/insforge/types";
import type { FoundationRepository } from "./repository";

export function readMvpSeededDataForOperations({
  repository,
}: {
  repository: FoundationRepository;
}): Promise<AppResult<MvpSeededData>> {
  return repository.readSeededData();
}

export function touchRoomForOperations({
  repository,
  roomId,
}: {
  repository: FoundationRepository;
  roomId: string;
}): Promise<AppResult<RoomRecord>> {
  return repository.touchRoom(roomId);
}

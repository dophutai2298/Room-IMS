import type { AppResult } from "@/lib/insforge/errors";
import type { RoomDetailView, RoomOperationsSummaryView } from "./presenter";

export type RoomDetailRepository = {
  readRoomDetail(roomId: string): Promise<AppResult<RoomDetailView>>;
  readRoomOperationsSummary(
    roomId: string,
  ): Promise<AppResult<RoomOperationsSummaryView>>;
};

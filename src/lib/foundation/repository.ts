import type { AppResult } from "@/lib/insforge/errors";
import type { MvpSeededData, RoomRecord } from "@/lib/insforge/types";

export type FoundationRepository = {
  readSeededData(): Promise<AppResult<MvpSeededData>>;
  touchRoom(roomId: string): Promise<AppResult<RoomRecord>>;
};

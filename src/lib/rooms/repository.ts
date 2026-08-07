import type { AppResult } from "@/lib/insforge/errors";
import type { RoomDbStatus } from "@/lib/insforge/types";
import type {
  RoomDetailView,
  RoomListItem,
  RoomOperationsSummaryView,
} from "./presenter";

export type RoomWriteStatus = Extract<RoomDbStatus, "Available" | "Maintenance">;

export type WriteRoomInput = {
  name: string;
  basePrice: number;
  status: RoomWriteStatus;
};

export type UpdateRoomInput = WriteRoomInput & {
  roomId: string;
};

export type RoomRepository = {
  listRoomItems(): Promise<AppResult<RoomListItem[]>>;
  createRoom(input: WriteRoomInput): Promise<AppResult<RoomListItem>>;
  updateRoom(input: UpdateRoomInput): Promise<AppResult<RoomListItem>>;
  readRoomDetail(roomId: string): Promise<AppResult<RoomDetailView>>;
  readRoomOperationsSummary(
    roomId: string,
  ): Promise<AppResult<RoomOperationsSummaryView>>;
};

import "server-only";

import { appError, type AppResult } from "@/lib/insforge/errors";
import type {
  RoomDetailView,
  RoomListItem,
  RoomOperationsSummaryView,
} from "./presenter";
import type {
  RoomRepository,
  RoomWriteStatus,
  UpdateRoomInput,
  WriteRoomInput,
} from "./repository";

export async function listRoomsForOperations({
  repository,
}: {
  repository: RoomRepository;
}): Promise<AppResult<RoomListItem[]>> {
  return repository.listRoomItems();
}

export async function createRoomForOperations({
  repository,
  name,
  basePrice,
  status,
}: WriteRoomInput & {
  repository: RoomRepository;
}): Promise<AppResult<RoomListItem>> {
  const validation = validateRoomWrite({ name, basePrice, status });

  if (validation.error) {
    return validation;
  }

  return repository.createRoom(validation.data);
}

export async function updateRoomForOperations({
  repository,
  roomId,
  name,
  basePrice,
  status,
}: UpdateRoomInput & {
  repository: RoomRepository;
}): Promise<AppResult<RoomListItem>> {
  if (!roomId.trim()) {
    return appError({
      message: "Room id is required.",
      code: "ROOM_ID_REQUIRED",
      statusCode: 422,
    });
  }

  const validation = validateRoomWrite({ name, basePrice, status });

  if (validation.error) {
    return validation;
  }

  return repository.updateRoom({
    roomId,
    ...validation.data,
  });
}

export async function getRoomDetailForOperations({
  repository,
  roomId,
}: {
  repository: RoomRepository;
  roomId: string;
}): Promise<AppResult<RoomDetailView>> {
  return repository.readRoomDetail(roomId);
}

export async function getRoomOperationsSummaryForOperations({
  repository,
  roomId,
}: {
  repository: RoomRepository;
  roomId: string;
}): Promise<AppResult<RoomOperationsSummaryView>> {
  return repository.readRoomOperationsSummary(roomId);
}

function validateRoomWrite({
  name,
  basePrice,
  status,
}: WriteRoomInput): AppResult<WriteRoomInput> {
  const cleanName = name.trim();

  if (!cleanName) {
    return appError({
      message: "Room name is required.",
      code: "ROOM_NAME_REQUIRED",
      statusCode: 422,
    });
  }

  if (!Number.isFinite(basePrice) || basePrice < 0) {
    return appError({
      message: "Room base rent must be a non-negative number.",
      code: "ROOM_BASE_PRICE_INVALID",
      statusCode: 422,
    });
  }

  if (!isRoomWriteStatus(status)) {
    return appError({
      message: "Room status must be Available or Maintenance.",
      code: "ROOM_STATUS_INVALID",
      statusCode: 422,
    });
  }

  return {
    data: {
      name: cleanName,
      basePrice: roundMoney(basePrice),
      status,
    },
    error: null,
  };
}

function isRoomWriteStatus(value: string): value is RoomWriteStatus {
  return value === "Available" || value === "Maintenance";
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

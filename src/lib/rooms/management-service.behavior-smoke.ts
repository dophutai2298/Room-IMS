import "server-only";

import type { AppResult } from "@/lib/insforge/errors";
import type { RoomListItem } from "./presenter";
import type {
  RoomRepository,
  UpdateRoomInput,
  WriteRoomInput,
} from "./repository";
import {
  createRoomForOperations,
  listRoomsForOperations,
  updateRoomForOperations,
} from "./service";

export async function runRoomManagementServiceBehaviorSmoke() {
  const repository = createSmokeRepository();

  return {
    listRooms: await listRoomsForOperations({ repository }),
    createRoom: await createRoomForOperations({
      repository,
      name: " P104 ",
      basePrice: 2_800_000,
      status: "Available",
    }),
    updateRoom: await updateRoomForOperations({
      repository,
      roomId: smokeRoom.id,
      name: "P104",
      basePrice: 2_900_000,
      status: "Maintenance",
    }),
    rejectMissingName: await createRoomForOperations({
      repository,
      name: "",
      basePrice: 2_800_000,
      status: "Available",
    }),
    rejectNegativeBaseRent: await createRoomForOperations({
      repository,
      name: "P105",
      basePrice: -1,
      status: "Available",
    }),
  };
}

function createSmokeRepository(): RoomRepository {
  return {
    async listRoomItems() {
      return ok([smokeRoom]);
    },
    async createRoom(input) {
      return ok(createRoomItem(input));
    },
    async updateRoom(input) {
      return ok(updateRoomItem(input));
    },
    async readRoomDetail() {
      return fail("SMOKE_DETAIL_NOT_USED");
    },
    async readRoomOperationsSummary() {
      return fail("SMOKE_SUMMARY_NOT_USED");
    },
  };
}

const smokeRoom: RoomListItem = {
  id: "00000000-0000-0000-0000-000000000104",
  name: "P104",
  status: "available",
  basePrice: 2_800_000,
  roomBasePrice: 2_800_000,
  tenantCount: 0,
  keyTenantName: null,
  activeContractId: null,
  nextAction: "Sẵn sàng cho thuê",
};

function createRoomItem(input: WriteRoomInput): RoomListItem {
  return {
    ...smokeRoom,
    name: input.name,
    status: input.status === "Maintenance" ? "maintenance" : "available",
    basePrice: input.basePrice,
    roomBasePrice: input.basePrice,
    nextAction:
      input.status === "Maintenance" ? "Kiểm tra bảo trì" : "Sẵn sàng cho thuê",
  };
}

function updateRoomItem(input: UpdateRoomInput): RoomListItem {
  return {
    ...createRoomItem(input),
    id: input.roomId,
  };
}

function ok<T>(data: T): AppResult<T> {
  return {
    data,
    error: null,
  };
}

function fail<T = never>(code: string): AppResult<T> {
  return {
    data: null,
    error: {
      code,
      message: code,
      statusCode: 500,
    },
  };
}

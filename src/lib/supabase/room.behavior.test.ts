import assert from "node:assert/strict";
import test from "node:test";

import { toSupabaseRoomListItem } from "./room-mapping";

test("imported occupied Room keeps its ID, floor and occupancy during staged migration", () => {
  const room = toSupabaseRoomListItem({
    id: "room-101",
    name: "Room 101",
    floor: 1,
    status: "Occupied",
    base_price: "2800000.00",
    owner_app_user_id: "owner-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  });
  assert.equal(room.id, "room-101");
  assert.equal(room.floor, 1);
  assert.equal(room.status, "occupied");
  assert.equal(room.basePrice, 2800000);
});

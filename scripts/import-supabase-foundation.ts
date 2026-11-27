/** Import only Auth mappings, app_users and Rooms into an isolated Supabase target. */
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type SourceAuth = { id: string; email: string; emailVerified: boolean };
type AppUserRow = {
  id: string; auth_user_id: string; email: string; display_name: string;
  role: "landlord" | "staff"; status: "active" | "disabled";
  owner_app_user_id: string; created_at: string; updated_at: string;
};
type RoomRow = {
  id: string; name: string; floor: number | string | null; status: string;
  base_price: number | string; owner_app_user_id: string;
  created_at: string; updated_at: string;
};
type Mapping = {
  source_auth_user_id: string; target_auth_user_id: string;
  app_user_id: string; email: string; source_email_verified: boolean;
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function normalizeFloor(value: number | string | null) {
  if (value === null) return null;
  assert(value !== "", "Room floor cannot be empty");
  const floor = Number(value);
  assert(Number.isInteger(floor) && floor >= 0 && floor <= 200, "Invalid Room floor");
  return floor;
}

async function readJson<T>(directory: string, file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(directory, file), "utf8")) as T;
}

async function main() {
  const [directory, mode, confirmedRef] = process.argv.slice(2);
  assert(directory && ["--validate", "--dry-run", "--apply"].includes(mode),
    "Usage: import-supabase-foundation.ts extracted-directory --validate|--dry-run|--apply [project-ref]");
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const projectRef = new URL(url).hostname.split(".")[0];
  assert(new URL(url).hostname === `${projectRef}.supabase.co`, "Expected a hosted Supabase project URL");
  assert(url !== process.env.NEXT_PUBLIC_INSFORGE_URL, "Target must differ from InsForge source");
  if (mode === "--apply") {
    assert(confirmedRef === projectRef, "Pass the exact target project ref after --apply");
  }

  const authUsers = await readJson<SourceAuth[]>(directory, "auth-users.json");
  const appUsers = await readJson<AppUserRow[]>(directory, "rows/app_users.json");
  const rooms = await readJson<RoomRow[]>(directory, "rows/rooms.json");
  const manifest = await readJson<{
    tables: Record<string, { ids: string[] }>;
    auth: { ids: string[] };
  }>(directory, "manifest.json");
  const ids = (rows: Array<{ id: string }>) => rows.map((row) => row.id).sort();
  assert(JSON.stringify(ids(appUsers)) === JSON.stringify([...manifest.tables.app_users.ids].sort()), "app_users manifest mismatch");
  assert(JSON.stringify(ids(rooms)) === JSON.stringify([...manifest.tables.rooms.ids].sort()), "Room manifest mismatch");
  assert(JSON.stringify(ids(authUsers)) === JSON.stringify([...manifest.auth.ids].sort()), "Auth manifest mismatch");
  const authById = new Map(authUsers.map((user) => [user.id, user]));
  const owners = new Set(appUsers.filter((user) => user.role === "landlord").map((user) => user.id));
  for (const user of appUsers) {
    const source = authById.get(user.auth_user_id);
    assert(source && source.email.toLowerCase() === user.email.toLowerCase(), "Auth mapping mismatch");
    assert(user.owner_app_user_id && owners.has(user.owner_app_user_id), "Invalid source owner mapping");
    assert(user.role !== "landlord" || user.owner_app_user_id === user.id, "Landlord owner mismatch");
  }
  for (const room of rooms) {
    assert(owners.has(room.owner_app_user_id), "Room owner mismatch");
    normalizeFloor(room.floor);
  }

  if (mode === "--validate") {
    console.log(JSON.stringify({ mode, projectRef, sourceAuth: authUsers.length,
      sourceAppUsers: appUsers.length, sourceRooms: rooms.length, manifestValid: true }));
    return;
  }

  const key = required("SUPABASE_SECRET_KEY");
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const ready = await admin.from("migration_identity_map").select("source_auth_user_id").limit(1);
  if (ready.error) throw new Error(`Target migrations are not ready: ${ready.error.code}`);
  if (mode === "--dry-run") {
    console.log(JSON.stringify({ mode, projectRef, sourceAuth: authUsers.length,
      sourceAppUsers: appUsers.length, sourceRooms: rooms.length, migrationsReady: true }));
    return;
  }

  let createdAuth = 0;
  let createdAppUsers = 0;
  let createdRooms = 0;
  for (const user of [...appUsers].sort((a, b) => Number(a.role === "staff") - Number(b.role === "staff"))) {
    const source = authById.get(user.auth_user_id)!;
    const existingMap = await admin.from("migration_identity_map").select("*")
      .eq("source_auth_user_id", source.id).maybeSingle();
    if (existingMap.error) throw new Error(`Identity map lookup failed: ${existingMap.error.code}`);
    let targetAuthId: string;
    if (existingMap.data) {
      const mapping = existingMap.data as Mapping;
      assert(mapping.app_user_id === user.id && mapping.email.toLowerCase() === user.email.toLowerCase() &&
        mapping.source_email_verified === source.emailVerified,
      "Existing identity map conflicts with source");
      const auth = await admin.auth.admin.getUserById(mapping.target_auth_user_id);
      assert(!auth.error && auth.data.user?.email?.toLowerCase() === user.email.toLowerCase(),
        "Mapped Supabase Auth identity is missing or mismatched");
      targetAuthId = mapping.target_auth_user_id;
    } else {
      const created = await admin.auth.admin.createUser({
        email: source.email,
        password: randomBytes(36).toString("base64url"),
        email_confirm: source.emailVerified === true,
      });
      // Never adopt an unrelated existing email after a failed create.
      if (created.error || !created.data.user) {
        throw new Error(`Auth create failed; stop and reconcile manually: ${created.error?.code ?? "NO_USER"}`);
      }
      targetAuthId = created.data.user.id;
      const mapped = await admin.from("migration_identity_map").insert({
        source_auth_user_id: source.id,
        target_auth_user_id: targetAuthId,
        app_user_id: user.id,
        email: user.email,
        source_email_verified: source.emailVerified,
      });
      if (mapped.error) {
        const compensation = await admin.auth.admin.deleteUser(targetAuthId);
        throw new Error(compensation.error
          ? "Identity map failed and Auth compensation failed; manual reconciliation required"
          : `Identity map failed and new Auth identity was removed: ${mapped.error.code}`);
      }
      createdAuth += 1;
    }

    const desired = {
      id: user.id, auth_user_id: targetAuthId, email: user.email,
      display_name: user.display_name, role: user.role, status: user.status,
      credential_ready: false,
      owner_app_user_id: user.owner_app_user_id,
      created_at: user.created_at, updated_at: user.updated_at,
    };
    const existing = await admin.from("app_users").select("*").eq("id", user.id).maybeSingle();
    if (existing.error) throw new Error(`app_users lookup failed: ${existing.error.code}`);
    if (existing.data) {
      for (const field of ["auth_user_id", "email", "display_name", "role", "status", "owner_app_user_id"] as const) {
        assert(existing.data[field] === desired[field], `Existing app_user ${user.id} conflicts on ${field}`);
      }
    } else {
      const inserted = await admin.from("app_users").insert(desired);
      if (inserted.error) throw new Error(`app_users insert failed: ${inserted.error.code}`);
      createdAppUsers += 1;
    }
  }

  for (const room of rooms) {
    const normalizedRoom = { ...room, floor: normalizeFloor(room.floor) };
    const existing = await admin.from("rooms").select("*").eq("id", room.id).maybeSingle();
    if (existing.error) throw new Error(`Room lookup failed: ${existing.error.code}`);
    if (existing.data) {
      for (const field of ["name", "floor", "status", "owner_app_user_id"] as const) {
        assert(existing.data[field] === normalizedRoom[field], `Existing Room ${room.id} conflicts on ${field}`);
      }
      assert(Number(existing.data.base_price) === Number(room.base_price), `Room rent conflict: ${room.id}`);
    } else {
      const inserted = await admin.from("rooms").insert(normalizedRoom);
      if (inserted.error) throw new Error(`Room insert failed: ${inserted.error.code}`);
      createdRooms += 1;
    }
  }
  console.log(JSON.stringify({ mode, projectRef, sourceAuth: authUsers.length,
    sourceAppUsers: appUsers.length, sourceRooms: rooms.length,
    createdAuth, createdAppUsers, createdRooms }));
}

await main();

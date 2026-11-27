/** Read-only reconciliation plus RLS probes inside a transaction that is always rolled back. */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

import { validateSupabaseMigrationTarget } from "../src/lib/supabase/migration-target";

type SourceUser = {
  id: string; auth_user_id: string; email: string; display_name: string;
  role: "landlord" | "staff"; status: string; owner_app_user_id: string;
};
type SourceRoom = {
  id: string; name: string; floor: number | string | null; status: string;
  base_price: number | string; owner_app_user_id: string;
};
type SourceAuth = { id: string; email: string; emailVerified: boolean };

class VerificationAssertionError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new VerificationAssertionError(message);
}

function readJson<T>(directory: string, file: string): T {
  return JSON.parse(readFileSync(path.join(directory, file), "utf8")) as T;
}

function sameIds(actual: string[], expected: string[]) {
  return JSON.stringify(actual.sort()) === JSON.stringify(expected.sort());
}

const directory = process.argv[2];
assert(directory, "Pass the extracted ticket-01 archive directory.");
const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const databaseUrl = process.env.SUPABASE_DB_URL;
assert(publicUrl && databaseUrl, "Supabase target settings are required.");
const projectRef = validateSupabaseMigrationTarget(publicUrl, databaseUrl);

const sourceUsers = readJson<SourceUser[]>(directory, "rows/app_users.json");
const sourceRooms = readJson<SourceRoom[]>(directory, "rows/rooms.json");
const sourceAuth = readJson<SourceAuth[]>(directory, "auth-users.json");
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: {
    ca: readFileSync(path.join(process.cwd(), "supabase", "certs", "prod-ca-2021.crt"), "utf8"),
    rejectUnauthorized: true,
  },
  connectionTimeoutMillis: 8_000,
  query_timeout: 30_000,
  application_name: "rentalroom201-foundation-verification",
});

async function main() {
  await client.connect();
  const users = await client.query<SourceUser & { credential_ready: boolean }>(
    "select id, auth_user_id, email, display_name, role, status, owner_app_user_id, credential_ready from public.app_users",
  );
  const rooms = await client.query<SourceRoom>(
    "select id, name, floor, status, base_price, owner_app_user_id from public.rooms",
  );
  const mappings = await client.query<{
    source_auth_user_id: string; target_auth_user_id: string; app_user_id: string;
    email: string; source_email_verified: boolean; auth_email: string;
  }>(`select m.source_auth_user_id, m.target_auth_user_id, m.app_user_id,
    m.email, m.source_email_verified, a.email as auth_email
    from public.migration_identity_map m
    join auth.users a on a.id = m.target_auth_user_id`);
  const authCount = await client.query<{ count: string }>("select count(*)::text as count from auth.users");

  assert(sameIds(users.rows.map((row) => row.id), sourceUsers.map((row) => row.id)), "app_users IDs differ");
  assert(sameIds(rooms.rows.map((row) => row.id), sourceRooms.map((row) => row.id)), "Room IDs differ");
  assert(sameIds(mappings.rows.map((row) => row.source_auth_user_id), sourceAuth.map((row) => row.id)),
    "Source Auth mapping IDs differ");
  assert(Number(authCount.rows[0]?.count) === sourceAuth.length, "Extra or missing target Auth identities");

  for (const source of sourceUsers) {
    const target = users.rows.find((row) => row.id === source.id)!;
    const mapping = mappings.rows.find((row) => row.app_user_id === source.id);
    assert(mapping?.source_auth_user_id === source.auth_user_id &&
      mapping.target_auth_user_id === target.auth_user_id &&
      mapping.email.toLowerCase() === source.email.toLowerCase() &&
      mapping.auth_email.toLowerCase() === source.email.toLowerCase(), "Application identity mismatch");
    for (const field of ["email", "display_name", "role", "status", "owner_app_user_id"] as const) {
      assert(target[field] === source[field], `app_users field mismatch: ${field}`);
    }
    assert(target.credential_ready === false, "Imported credential is unexpectedly ready");
  }
  for (const source of sourceRooms) {
    const target = rooms.rows.find((row) => row.id === source.id)!;
    for (const field of ["name", "status", "owner_app_user_id"] as const) {
      assert(target[field] === source[field], `Room field mismatch: ${field}`);
    }
    assert(target.floor === (source.floor === null ? null : Number(source.floor)), "Room floor mismatch");
    assert(Number(target.base_price) === Number(source.base_price), "Room rent mismatch");
  }

  const landlords = sourceUsers.filter((row) => row.role === "landlord");
  assert(landlords.length >= 2, "Two Landlords are required for the RLS probe");
  await client.query("begin");
  try {
    const firstTargetAuthId = users.rows.find((row) => row.id === landlords[0].id)!.auth_user_id;
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [firstTargetAuthId]);
    await client.query("set local role authenticated");
    const unreadyRooms = await client.query("select id from public.rooms");
    assert(unreadyRooms.rowCount === 0, "An imported account can read Rooms before credential setup");
    await client.query("reset role");

    await client.query("savepoint anon_probe");
    await client.query("set local role anon");
    let anonymousDenied = false;
    try {
      await client.query("select id from public.rooms");
    } catch (error) {
      anonymousDenied = typeof error === "object" && error !== null && "code" in error &&
        error.code === "42501";
    } finally {
      await client.query("rollback to savepoint anon_probe");
    }
    assert(anonymousDenied, "Anonymous Room access was not denied by table privileges");

    const activated = await client.query("update public.app_users set credential_ready = true where id = any($1::uuid[])",
      [landlords.map((row) => row.id)]);
    assert(activated.rowCount === landlords.length, "RLS probe could not activate the temporary mappings");
    for (const user of landlords) {
      const targetAuthId = users.rows.find((row) => row.id === user.id)!.auth_user_id;
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [targetAuthId]);
      const direct = await client.query<{ match_count: string; subject_matches: boolean }>(
        "select (select count(*)::text from public.app_users where auth_user_id = $1::uuid and status = 'active' and credential_ready = true) as match_count, auth.uid() = $1::uuid as subject_matches",
        [targetAuthId],
      );
      assert(direct.rows[0]?.subject_matches, "RLS probe subject unavailable before role switch");
      assert(Number(direct.rows[0]?.match_count) === 1, "RLS probe active mapping unavailable before role switch");
      const beforeRole = await client.query<{ owner_matches: boolean }>(
        "select public.current_app_user_owner_id() = $1::uuid as owner_matches", [user.id],
      );
      assert(beforeRole.rows[0]?.owner_matches, "RLS probe owner unavailable before role switch");
      await client.query("set local role authenticated");
      const context = await client.query<{ subject_matches: boolean; owner_matches: boolean }>(
        "select auth.uid() = $1::uuid as subject_matches, public.current_app_user_owner_id() = $2::uuid as owner_matches",
        [targetAuthId, user.id],
      );
      assert(context.rows[0]?.subject_matches, "RLS probe did not set auth subject");
      assert(context.rows[0]?.owner_matches, "RLS probe did not resolve application owner");
      const visible = await client.query<{ id: string }>("select id from public.rooms");
      assert(sameIds(visible.rows.map((row) => row.id),
        sourceRooms.filter((row) => row.owner_app_user_id === user.id).map((row) => row.id)),
      "Landlord Room visibility differs from owner scope");
      await client.query("reset role");
    }

    // Temporarily turn an account into Staff of an owner with Rooms, then roll it all back.
    const owner = landlords.find((row) => sourceRooms.some((room) => room.owner_app_user_id === row.id));
    assert(owner, "An imported Landlord needs a Room for the Staff write probe");
    const staff = landlords.find((row) => row.id !== owner.id)!;
    await client.query("update public.app_users set role = 'staff', owner_app_user_id = $1 where id = $2",
      [owner.id, staff.id]);
    const staffTargetAuthId = users.rows.find((row) => row.id === staff.id)!.auth_user_id;
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [staffTargetAuthId]);
    await client.query("set local role authenticated");
    const visible = await client.query<{ id: string }>("select id from public.rooms");
    assert(sameIds(visible.rows.map((row) => row.id),
      sourceRooms.filter((row) => row.owner_app_user_id === owner.id).map((row) => row.id)),
    "Staff Room visibility differs from assigned owner scope");
    const existingRoom = sourceRooms.find((row) => row.owner_app_user_id === owner.id)!;
    const deniedUpdate = await client.query("update public.rooms set name = name where id = $1 returning id",
      [existingRoom.id]);
    assert(deniedUpdate.rowCount === 0, "Staff can update a Room");
    const deniedDelete = await client.query("delete from public.rooms where id = $1 returning id",
      [existingRoom.id]);
    assert(deniedDelete.rowCount === 0, "Staff can delete a Room");
    const created = await client.query(
      "insert into public.rooms(id, name, status, base_price, owner_app_user_id) values($1, $2, $3, $4, $5) returning id",
      [randomUUID(), "RLS probe (rolled back)", "Available", 0, owner.id],
    );
    assert(created.rowCount === 1, "Staff cannot create an owned Room");
    await client.query("reset role");
    await client.query("update public.app_users set status = 'disabled' where id = $1", [staff.id]);
    await client.query("set local role authenticated");
    const disabledRooms = await client.query("select id from public.rooms");
    assert(disabledRooms.rowCount === 0, "Disabled Staff can read Rooms");
  } finally {
    await client.query("rollback");
  }
  console.log(JSON.stringify({ projectRef, sourceAuth: sourceAuth.length, appUsers: users.rows.length,
    rooms: rooms.rows.length, identityAndRoomFieldsMatch: true,
    landlordIsolation: true, staffReadCreateOnly: true,
    unreadyAnonymousDisabledDenied: true, probeRolledBack: true }));
}

void (async () => {
  try {
    await main();
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String(error.code) : "VERIFICATION_FAILED";
    const message = error instanceof VerificationAssertionError
      ? error.message : "Foundation verification failed; inspect the probe and target state.";
    console.error(JSON.stringify({ code, message }));
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
})();

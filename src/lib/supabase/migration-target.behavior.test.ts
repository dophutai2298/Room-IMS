import assert from "node:assert/strict";
import test from "node:test";

import { validateSupabaseMigrationTarget } from "./migration-target";

test("migration target accepts only the matching hosted project", () => {
  assert.equal(validateSupabaseMigrationTarget(
    "https://myref.supabase.co",
    "postgresql://postgres:secret@db.myref.supabase.co:5432/postgres",
  ), "myref");
  assert.equal(validateSupabaseMigrationTarget(
    "https://myref.supabase.co",
    "postgresql://postgres.myref:secret@aws-0-region.pooler.supabase.com:5432/postgres",
  ), "myref");
  for (const bad of [
    "postgresql://postgres:secret@db.otherref.supabase.co:5432/postgres",
    "postgresql://postgres.otherref:secret@aws-0-region.pooler.supabase.com:5432/postgres",
    "postgresql://postgres:secret@localhost:5432/postgres",
    "postgresql://postgres:secret@db.myref.supabase.co:5432/other",
    "postgresql://postgres:%5BYOUR-DATABASE-PASSWORD%5D@db.myref.supabase.co:5432/postgres",
  ]) {
    assert.throws(() => validateSupabaseMigrationTarget("https://myref.supabase.co", bad));
  }
});

import { getActiveOwnerAppUserId } from "@/lib/server/operational-owner-scope";
import { withOperationalAuth } from "@/lib/server/operational-route";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tenantDocumentBucket } from "@/lib/supabase/tenant-repository";
import { getAppBackend } from "@/lib/backend/selection";

export const dynamic = "force-dynamic";

export const GET = withOperationalAuth(
  { operation: "tenants.cccd-images.content" },
  async (_context, _request: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) => {
    if (getAppBackend() !== "supabase") return new Response(null, { status: 404 });
    const { id, imageId } = await params;
    const client = await createSupabaseServerClient();
    const row = await client.from("tenant_cccd_images").select("storage_key,mime_type")
      .eq("id", imageId).eq("tenant_id", id)
      .eq("owner_app_user_id", getActiveOwnerAppUserId()).maybeSingle();
    if (row.error || !row.data) return new Response(null, { status: 404 });
    const file = await client.storage.from(tenantDocumentBucket).download(row.data.storage_key);
    if (file.error || !file.data) return new Response(null, { status: 404 });
    const type = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(row.data.mime_type ?? "")
      ? row.data.mime_type! : "application/octet-stream";
    return new Response(await file.data.arrayBuffer(), {
      headers: { "Content-Type": type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  },
);

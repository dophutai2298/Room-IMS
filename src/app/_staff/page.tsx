import { StaffManagementClient } from "./staff-management-client";
import { getAppBackend } from "@/lib/backend/selection";

export default function StaffPage() {
  return <StaffManagementClient requiresEmailVerification={getAppBackend() === "supabase"} />;
}

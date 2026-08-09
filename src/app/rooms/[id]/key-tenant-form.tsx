"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import {
  initialKeyTenantActionState,
  markKeyTenant,
} from "@/app/rooms/[id]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { contractQueryKeys } from "@/lib/contracts/query-keys";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import type { TenantView } from "@/lib/rooms/presenter";
import { roomQueryKeys } from "@/lib/rooms/query-keys";
import { tenantQueryKeys } from "@/lib/tenants/query-keys";

export function KeyTenantForm({
  roomId,
  tenants,
  activeContractId,
  currentKeyTenantId,
}: {
  roomId: string;
  tenants: TenantView[];
  activeContractId: string | null;
  currentKeyTenantId: string | null;
}) {
  const [state, formAction] = useActionState(
    markKeyTenant,
    initialKeyTenantActionState,
  );
  const queryClient = useQueryClient();
  const selectableTenants = tenants.filter((tenant) => tenant.status === "Active");
  const canSave = Boolean(activeContractId) && selectableTenants.length > 0;

  useEffect(() => {
    if (state.status === "success") {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: roomQueryKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: tenantQueryKeys.room(roomId),
        }),
        queryClient.invalidateQueries({
          queryKey: contractQueryKeys.room(roomId),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardQueryKeys.all,
        }),
      ]);
    }
  }, [queryClient, roomId, state.status]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="roomId" value={roomId} />

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Key Tenant</p>
          {currentKeyTenantId && <Badge variant="secondary">Active Contract</Badge>}
        </div>
        <Select
          name="tenantId"
          defaultValue={currentKeyTenantId ?? undefined}
          disabled={!canSave}
        >
          <SelectTrigger>
            <SelectValue placeholder="Chọn Tenant trong phòng" />
          </SelectTrigger>
          <SelectContent>
            {selectableTenants.map((tenant) => (
              <SelectItem key={tenant.id} value={tenant.id}>
                {tenant.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!activeContractId && (
        <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Phòng chưa có active Contract nên chưa thể gán Key Tenant.
        </p>
      )}

      {activeContractId && selectableTenants.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Active Contract cần ít nhất một Tenant đang active trong cùng phòng.
        </p>
      )}

      {state.message && (
        <p
          className={
            state.status === "success"
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
              : "rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          }
        >
          {state.message}
        </p>
      )}

      <SaveButton disabled={!canSave} />
    </form>
  );
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={disabled || pending}>
      {pending ? "Đang lưu..." : "Lưu Key Tenant"}
    </Button>
  );
}

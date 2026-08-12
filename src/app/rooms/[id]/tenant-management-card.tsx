"use client";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAppApi } from "@/lib/api/client";
import type { TenantListItem } from "@/lib/tenants/presenter";
import { tenantQueryKeys } from "@/lib/tenants/query-keys";
import {
  TenantDeleteButton,
  TenantEditorDialog,
  TenantImageGallery,
  TenantStatusBadge,
} from "@/app/tenants/tenant-management-components";

export function TenantManagementCard({
  roomId,
  roomName,
}: {
  roomId: string;
  roomName: string;
}) {
  const tenantsQuery = useQuery({
    queryKey: tenantQueryKeys.room(roomId),
    queryFn: () =>
      fetchAppApi<TenantListItem[]>(`/api/rooms/${roomId}/tenants`, {
        cache: "no-store",
      }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Danh sách Người thuê</CardTitle>
            <CardDescription>
              Số lượng người ở của phòng {roomName} là <b>{tenantsQuery?.data?.length}</b>
            </CardDescription>
          </div>
          <TenantEditorDialog mode="create" fixedRoomId={roomId} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {tenantsQuery.isPending ? (
          <TenantListSkeleton />
        ) : tenantsQuery.isError ? (
          <TenantErrorState
            message={tenantsQuery.error.message}
            onRetry={() => void tenantsQuery.refetch()}
          />
        ) : tenantsQuery.data.length > 0 ? (
          tenantsQuery.data.map((tenant) => (
            <TenantCard key={tenant.id} roomId={roomId} tenant={tenant} />
          ))
        ) : (
          <TenantEmptyState onRetry={() => void tenantsQuery.refetch()} />
        )}
      </CardContent>
    </Card>
  );
}

function TenantCard({
  roomId,
  tenant,
}: {
  roomId: string;
  tenant: TenantListItem;
}) {
  return (
    <div className="rounded-2xl border border-white/45 bg-background/35 p-4 clay-inset dark:border-white/8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{tenant.name}</p>
            {tenant.isKeyTenant && <Badge variant="default">Người đại diện</Badge>}
            <TenantStatusBadge status={tenant.status} />
          </div>
          <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            <p>SĐT: {tenant.phone ?? "Chưa có"}</p>
            <p>CCCD: {tenant.cccdNumber ?? "Chưa có"}</p>
            <p>Ngày sinh: {tenant.dateOfBirth ?? "Chưa có"}</p>
            <p>Thường trú: {tenant.permanentAddress ?? "Chưa có"}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <TenantEditorDialog
            mode="edit"
            tenant={tenant}
            fixedRoomId={roomId}
            triggerSize="sm"
          />
          <TenantDeleteButton tenant={tenant} />
        </div>
      </div>
      <Separator className="my-4" />
      <TenantImageGallery images={tenant.cccdImages} compact />
      {tenant.isKeyTenant && ( <p className="mt-4 text-sm text-muted-foreground">
        Vai trò Người đại diện được xác định bằng kích hoạt Hợp đồng của phòng.
      </p>)}
    </div>
  );
}

function TenantListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border/60 bg-muted/20 p-4"
        >
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-3 h-4 w-32" />
          <Skeleton className="mt-5 h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function TenantEmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6">
      <p className="font-medium">Chưa có Tenant</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Thêm Tenant đầu tiên để bắt đầu quản lý liên hệ, CCCD và Key Tenant.
      </p>
      <Button className="mt-4" variant="secondary" onClick={onRetry}>
        Tải lại
      </Button>
    </div>
  );
}

function TenantErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4">
      <Badge variant="destructive">Lỗi API</Badge>
      <p className="mt-3 text-sm text-destructive">{message}</p>
      <Button className="mt-4" variant="secondary" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  );
}

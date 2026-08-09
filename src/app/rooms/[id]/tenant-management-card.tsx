"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AppApiClientError, fetchAppApi } from "@/lib/api/client";
import { contractQueryKeys } from "@/lib/contracts/query-keys";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import { roomQueryKeys } from "@/lib/rooms/query-keys";
import {
  tenantStatusLabel,
  type TenantListItem,
} from "@/lib/tenants/presenter";
import type { TenantWriteStatus } from "@/lib/tenants/repository";
import { tenantQueryKeys } from "@/lib/tenants/query-keys";

type TenantDraft = {
  name: string;
  phone: string;
  status: TenantWriteStatus;
};

const defaultTenantDraft: TenantDraft = {
  name: "",
  phone: "",
  status: "Active",
};

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
            <CardTitle>Danh sách Tenant</CardTitle>
            <CardDescription>
              Tenant đang gắn với {roomName}, tải qua API tenant riêng.
            </CardDescription>
          </div>
          <TenantEditorDialog mode="create" roomId={roomId} />
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
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{tenant.name}</p>
            {tenant.isKeyTenant && <Badge variant="default">Key Tenant</Badge>}
            <TenantStatusBadge status={tenant.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {tenant.phone ?? "Chưa có số điện thoại"}
          </p>
        </div>
        <TenantEditorDialog mode="edit" roomId={roomId} tenant={tenant} />
      </div>
      <Separator className="my-4" />
      <p className="text-sm text-muted-foreground">
        Vai trò Key Tenant được xác định bằng active Contract của phòng.
      </p>
    </div>
  );
}

function TenantEditorDialog({
  mode,
  roomId,
  tenant,
}: {
  mode: "create" | "edit";
  roomId: string;
  tenant?: TenantListItem;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TenantDraft>(() => getInitialDraft(tenant));
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const validationMessage = useMemo(() => validateTenantDraft(draft), [draft]);
  const isEdit = mode === "edit";
  const tenantDetailQuery = useQuery({
    queryKey: tenantQueryKeys.detail(tenant?.id ?? ""),
    queryFn: () =>
      fetchAppApi<TenantListItem>(`/api/tenants/${tenant?.id}`, {
        cache: "no-store",
      }),
    enabled: open && isEdit && Boolean(tenant?.id),
  });

  const mutation = useMutation<
    TenantListItem,
    AppApiClientError,
    {
      name: string;
      phone: string | null;
      status: TenantWriteStatus;
    }
  >({
    mutationFn: (payload) =>
      fetchAppApi<TenantListItem>(
        isEdit ? `/api/tenants/${tenant?.id}` : `/api/rooms/${roomId}/tenants`,
        {
          method: isEdit ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: async (savedTenant) => {
      queryClient.setQueryData<TenantListItem[]>(
        tenantQueryKeys.room(roomId),
        (current) => {
          if (!current) {
            return [savedTenant];
          }

          const exists = current.some((item) => item.id === savedTenant.id);
          const next = exists
            ? current.map((item) =>
                item.id === savedTenant.id ? savedTenant : item,
              )
            : [...current, savedTenant];

          return sortTenantItems(next);
        },
      );

      await invalidateTenantDependents({ queryClient, roomId, tenantId: savedTenant.id });
      toast.success(isEdit ? "Đã cập nhật Tenant." : "Đã thêm Tenant mới.");
      setOpen(false);
    },
    onError: (error) => {
      setServerMessage(error.message);
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      setDraft(getInitialDraft(tenant));
      setServerMessage(null);
      mutation.reset();
    }
  }

  function handleSubmit() {
    if (validationMessage || mutation.isPending) {
      setServerMessage(validationMessage);
      return;
    }

    setServerMessage(null);
    mutation.mutate({
      name: draft.name,
      phone: draft.phone.trim() || null,
      status: draft.status,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size={isEdit ? "sm" : "default"} variant={isEdit ? "outline" : "default"}>
          {isEdit ? "Cập nhật" : "Thêm Tenant"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Cập nhật Tenant" : "Thêm Tenant"}</DialogTitle>
          <DialogDescription>
            Lưu thông tin định danh và liên hệ của Tenant vào InsForge thông qua
            API nội bộ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor={`tenant-name-${mode}-${tenant?.id ?? "new"}`}>
              Họ tên
            </Label>
            <Input
              id={`tenant-name-${mode}-${tenant?.id ?? "new"}`}
              value={draft.name}
              placeholder="Nguyễn Văn A"
              disabled={mutation.isPending}
              onChange={(event) => {
                setDraft((current) => ({ ...current, name: event.target.value }));
                setServerMessage(null);
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`tenant-phone-${mode}-${tenant?.id ?? "new"}`}>
              Số điện thoại
            </Label>
            <Input
              id={`tenant-phone-${mode}-${tenant?.id ?? "new"}`}
              value={draft.phone}
              placeholder="0900000000"
              disabled={mutation.isPending}
              onChange={(event) => {
                setDraft((current) => ({ ...current, phone: event.target.value }));
                setServerMessage(null);
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`tenant-status-${mode}-${tenant?.id ?? "new"}`}>
              Trạng thái
            </Label>
            <Select
              value={draft.status}
              disabled={mutation.isPending}
              onValueChange={(value) => {
                setDraft((current) => ({
                  ...current,
                  status: value as TenantWriteStatus,
                }));
                setServerMessage(null);
              }}
            >
              <SelectTrigger id={`tenant-status-${mode}-${tenant?.id ?? "new"}`}>
                <SelectValue placeholder="Chọn trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Đang ở</SelectItem>
                <SelectItem value="Moved Out">Đã chuyển đi</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Key Tenant vẫn được điều khiển bởi active Contract, không set trực
              tiếp trên Tenant.
            </p>
          </div>

          {(validationMessage || serverMessage) && (
            <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {serverMessage ?? validationMessage}
            </p>
          )}

          {tenantDetailQuery.isError && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Không tải được chi tiết Tenant mới nhất. Bạn vẫn có thể chỉnh dữ
              liệu đang hiển thị trên card.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending || Boolean(validationMessage)}
          >
            {mutation.isPending
              ? "Đang lưu..."
              : isEdit
                ? "Lưu thay đổi"
                : "Thêm Tenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        Thêm Tenant đầu tiên để bắt đầu quản lý liên hệ và chọn Key Tenant cho
        active Contract.
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

function TenantStatusBadge({ status }: { status: TenantWriteStatus }) {
  return (
    <Badge variant={status === "Active" ? "success" : "outline"}>
      {tenantStatusLabel[status]}
    </Badge>
  );
}

function getInitialDraft(tenant?: TenantListItem): TenantDraft {
  if (!tenant) {
    return defaultTenantDraft;
  }

  return {
    name: tenant.name,
    phone: tenant.phone ?? "",
    status: tenant.status,
  };
}

function validateTenantDraft(draft: TenantDraft) {
  if (!draft.name.trim()) {
    return "Nhập họ tên Tenant.";
  }

  if (draft.status !== "Active" && draft.status !== "Moved Out") {
    return "Chọn trạng thái Tenant hợp lệ.";
  }

  return null;
}

function sortTenantItems(items: TenantListItem[]) {
  return [...items].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "Active" ? -1 : 1;
    }

    if (left.isKeyTenant !== right.isKeyTenant) {
      return left.isKeyTenant ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

async function invalidateTenantDependents({
  queryClient,
  roomId,
  tenantId,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  roomId: string;
  tenantId: string;
}) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: tenantQueryKeys.room(roomId) }),
    queryClient.invalidateQueries({ queryKey: tenantQueryKeys.detail(tenantId) }),
    queryClient.invalidateQueries({ queryKey: roomQueryKeys.detail(roomId) }),
    queryClient.invalidateQueries({ queryKey: roomQueryKeys.list() }),
    queryClient.invalidateQueries({ queryKey: contractQueryKeys.room(roomId) }),
    queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
  ]);
}

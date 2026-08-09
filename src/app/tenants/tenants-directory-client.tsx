"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchAppApi } from "@/lib/api/client";
import type { RoomListItem } from "@/lib/rooms/presenter";
import { roomQueryKeys } from "@/lib/rooms/query-keys";
import type { TenantListItem } from "@/lib/tenants/presenter";
import { tenantQueryKeys } from "@/lib/tenants/query-keys";
import {
  TenantDeleteButton,
  TenantEditorDialog,
  TenantImageGallery,
  TenantStatusBadge,
  type TenantRoomOption,
} from "./tenant-management-components";

export function TenantsDirectoryClient() {
  const [search, setSearch] = useState("");
  const trimmedSearch = search.trim();
  const tenantsQuery = useQuery({
    queryKey: tenantQueryKeys.list(trimmedSearch),
    queryFn: () =>
      fetchAppApi<TenantListItem[]>(
        `/api/tenants${trimmedSearch ? `?search=${encodeURIComponent(trimmedSearch)}` : ""}`,
        { cache: "no-store" },
      ),
  });
  const roomsQuery = useQuery({
    queryKey: roomQueryKeys.list(),
    queryFn: () =>
      fetchAppApi<RoomListItem[]>("/api/rooms", {
        cache: "no-store",
      }),
  });
  const roomOptions = useMemo<TenantRoomOption[]>(
    () =>
      (roomsQuery.data ?? []).map((room) => ({
        id: room.id,
        name: room.name,
      })),
    [roomsQuery.data],
  );

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Quản lý Người thuê</p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Danh bạ Người thuê
          </h1>
          {/* <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Quản lý toàn bộ Tenant, hồ sơ CCCD, phòng đang ở và trạng thái từ
            một bảng tập trung.
          </p> */}
        </div>
        <TenantEditorDialog
          mode="create"
          rooms={roomOptions}
          triggerLabel="Thêm Tenant"
        />
      </header>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

            <div className="w-full max-w-md">
              <Input
                value={search}
                placeholder="Tìm kiếm bằng tên..."
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tenantsQuery.isPending ? (
            <TenantsTableSkeleton />
          ) : tenantsQuery.isError ? (
            <TenantDirectoryError
              message={tenantsQuery.error.message}
              onRetry={() => void tenantsQuery.refetch()}
            />
          ) : tenantsQuery.data.length === 0 ? (
            <TenantDirectoryEmpty
              hasSearch={Boolean(trimmedSearch)}
              onRetry={() => void tenantsQuery.refetch()}
            />
          ) : (
            <TenantsTable tenants={tenantsQuery.data} roomOptions={roomOptions} />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function TenantsTable({
  tenants,
  roomOptions,
}: {
  tenants: TenantListItem[];
  roomOptions: TenantRoomOption[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Họ tên</TableHead>
          <TableHead>Phòng</TableHead>
          <TableHead>CCCD</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>Ảnh</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tenants.map((tenant) => (
          <TableRow key={tenant.id}>
            <TableCell>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{tenant.name}</span>
                  {tenant.isKeyTenant && <Badge>Người thuê chính</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {tenant.phone ?? "Chưa có SĐT"}
                </p>
              </div>
            </TableCell>
            <TableCell>{tenant.roomName ?? "Chưa gắn phòng"}</TableCell>
            <TableCell>
              <div className="space-y-1">
                <p>{tenant.cccdNumber ?? "Chưa có"}</p>
                <p className="text-xs text-muted-foreground">
                  {tenant.dateOfBirth ?? "Chưa có ngày sinh"}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <TenantStatusBadge status={tenant.status} />
            </TableCell>
            <TableCell>{tenant.cccdImages.length} ảnh</TableCell>
            <TableCell>
              <div className="flex flex-wrap justify-end gap-2">
                <TenantDetailDialog tenant={tenant} roomOptions={roomOptions} />
                <TenantEditorDialog
                  mode="edit"
                  tenant={tenant}
                  rooms={roomOptions}
                  triggerSize="sm"
                />
                <TenantDeleteButton tenant={tenant} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TenantDetailDialog({
  tenant,
  roomOptions,
}: {
  tenant: TenantListItem;
  roomOptions: TenantRoomOption[];
}) {
  console.log("tenant:::",tenant)
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          Detail
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{tenant.name}</DialogTitle>
          <DialogDescription>
            Hồ sơ Người thuê, CCCD, ảnh định danh và phòng đang thuê.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailBlock label="Phòng" value={tenant.roomName ?? "Chưa gắn phòng"} />
          <DetailBlock label="Số điện thoại" value={tenant.phone ?? "Chưa có"} />
          <DetailBlock label="Số CCCD" value={tenant.cccdNumber ?? "Chưa có"} />
          <DetailBlock
            label="Ngày tháng năm sinh"
            value={tenant.dateOfBirth ?? "Chưa có"}
          />
          <DetailBlock
            label="Nơi thường trú"
            value={tenant.permanentAddress ?? "Chưa có"}
            className="sm:col-span-2"
          />
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-medium">Ảnh Hồ sơ</p>
            <TenantImageGallery images={tenant.cccdImages} />
          </div>
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
            <TenantEditorDialog
              mode="edit"
              tenant={tenant}
              rooms={roomOptions}
              triggerSize="sm"
            />
            <TenantDeleteButton tenant={tenant} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailBlock({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 rounded-2xl border border-white/45 bg-background/35 px-4 py-3 text-sm clay-inset dark:border-white/8">
        {value}
      </p>
    </div>
  );
}

function TenantsTableSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border/60 bg-muted/20 p-4"
        >
          <Skeleton className="h-5 w-52" />
          <Skeleton className="mt-3 h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function TenantDirectoryError({
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

function TenantDirectoryEmpty({
  hasSearch,
  onRetry,
}: {
  hasSearch: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/25 p-8 text-center">
      <p className="text-lg font-semibold">
        {hasSearch ? "Không tìm thấy Tenant" : "Chưa có Tenant"}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {hasSearch
          ? "Thử đổi từ khoá search hoặc tải lại dữ liệu."
          : "Thêm Tenant đầu tiên và chọn phòng tương ứng."}
      </p>
      <Button className="mt-5" variant="secondary" onClick={onRetry}>
        Tải lại
      </Button>
    </div>
  );
}

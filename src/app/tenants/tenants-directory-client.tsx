"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fetchAppApi } from "@/lib/api/client";
import { createDataTableColumnHelper } from "@/lib/data-table/tanstack";
import type { RoomListItem } from "@/lib/rooms/presenter";
import { roomQueryKeys } from "@/lib/rooms/query-keys";
import {
  tenantStatusLabel,
  type TenantListItem,
} from "@/lib/tenants/presenter";
import { tenantQueryKeys } from "@/lib/tenants/query-keys";
import {
  TenantDeleteButton,
  TenantEditorDialog,
  TenantImageGallery,
  TenantStatusBadge,
  type TenantRoomOption,
} from "./tenant-management-components";
import dayjs from 'dayjs';

const tenantColumnHelper = createDataTableColumnHelper<TenantListItem>();

export function TenantsDirectoryClient() {
  const tenantsQuery = useQuery({
    queryKey: tenantQueryKeys.list(),
    queryFn: () =>
      fetchAppApi<TenantListItem[]>("/api/tenants", {
        cache: "no-store",
      }),
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
  const columns = useMemo(
    () =>
      tenantColumnHelper.columns([
        tenantColumnHelper.accessor("name", {
          header: "Họ tên",
          cell: (info) => (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{info.getValue()}</span>
                {info.row.original.isKeyTenant && <Badge>Người thuê chính</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {info.row.original.phone ?? "Chưa có SĐT"}
              </p>
            </div>
          ),
          sortFn: "alphanumeric",
        }),
        tenantColumnHelper.accessor(
          (tenant) => tenant.roomName ?? "Chưa gắn phòng",
          {
            id: "roomName",
            header: "Phòng",
            sortFn: "alphanumeric",
          },
        ),
        tenantColumnHelper.accessor(
          (tenant) => tenant.cccdNumber ?? "Chưa có",
          {
            id: "cccdNumber",
            header: "CCCD",
            cell: (info) => (
              <div className="space-y-1">
                <p>{info.getValue()}</p>
                <p className="text-xs text-muted-foreground">
                  {dayjs(info.row.original.dateOfBirth).format('DD/MM/YYYY') ?? "Chưa có ngày sinh"}
                </p>
              </div>
            ),
            sortFn: "alphanumeric",
          },
        ),
        tenantColumnHelper.accessor("status", {
          header: "Trạng thái",
          cell: (info) => <TenantStatusBadge status={info.getValue()} />,
          enableGlobalFilter: false,
          filterFn: "equalsString",
          sortFn: "alphanumeric",
        }),
        tenantColumnHelper.accessor((tenant) => tenant.cccdImages.length, {
          id: "cccdImages",
          header: "Ảnh",
          cell: (info) => (
            <span className="font-mono tabular-nums">{info.getValue()} ảnh</span>
          ),
          enableGlobalFilter: false,
        }),
        tenantColumnHelper.display({
          id: "actions",
          header: "Action",
          cell: ({ row }) => (
            <div className="flex flex-wrap justify-end gap-2">
              <TenantDetailDialog tenant={row.original} roomOptions={roomOptions} />
              <TenantEditorDialog
                mode="edit"
                tenant={row.original}
                rooms={roomOptions}
                triggerSize="sm"
              />
              <TenantDeleteButton tenant={row.original} />
            </div>
          ),
          enableHiding: false,
          enableSorting: false,
        }),
      ]),
    [roomOptions],
  );

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-7">
        <div>
          <p className="text-sm font-semibold text-primary">Quản lý Người thuê</p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Danh bạ Người thuê
          </h1>
        </div>
        <TenantEditorDialog
          mode="create"
          rooms={roomOptions}
          triggerLabel="Thêm người thuê mới"
        />
      </header>

      <DataTable
        columns={columns}
        data={tenantsQuery.data ?? []}
        emptyMessage="Thêm Tenant đầu tiên và chọn phòng tương ứng."
        emptyTitle="Chưa có Tenant"
        errorMessage={tenantsQuery.isError ? tenantsQuery.error.message : undefined}
        filteredEmptyMessage="Thử đổi từ khóa search hoặc trạng thái Tenant."
        filteredEmptyTitle="Không tìm thấy Tenant"
        isFetching={tenantsQuery.isFetching || roomsQuery.isFetching}
        isLoading={tenantsQuery.isPending}
        onRetry={() => {
          void tenantsQuery.refetch();
          void roomsQuery.refetch();
        }}
        searchPlaceholder="Tìm Tenant, phòng, CCCD..."
        statusFilter={{
          columnId: "status",
          label: "Lọc trạng thái",
          allLabel: "Tất cả trạng thái",
          options: [
            { value: "Active", label: tenantStatusLabel.Active },
            { value: "Moved Out", label: tenantStatusLabel["Moved Out"] },
          ],
        }}
        // title="Danh sách"
      />
    </>
  );
}

function TenantDetailDialog({
  tenant,
  roomOptions,
}: {
  tenant: TenantListItem;
  roomOptions: TenantRoomOption[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          Xem
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{tenant.name}</DialogTitle>
          <DialogDescription>
            Hồ sơ Người thuê, CCCD, ảnh định danh và phòng đang thuê.
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
            <p className="text-sm font-medium">Ảnh Hồ sơ</p>
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

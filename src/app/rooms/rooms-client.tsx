"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { AppApiClientError, fetchAppApi } from "@/lib/api/client";
import { createDataTableColumnHelper } from "@/lib/data-table/tanstack";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import { formatCurrency } from "@/lib/formatters";
import {
  roomStatusLabel,
  type RoomListItem,
  type RoomUiStatus,
} from "@/lib/rooms/presenter";
import type { RoomWriteStatus } from "@/lib/rooms/repository";
import { roomQueryKeys } from "@/lib/rooms/query-keys";

type RoomDraft = {
  name: string;
  basePrice: string;
  status: RoomWriteStatus;
};

const defaultRoomDraft: RoomDraft = {
  name: "",
  basePrice: "",
  status: "Available",
};

const roomColumnHelper = createDataTableColumnHelper<RoomListItem>();

export function RoomsClient() {
  const roomsQuery = useQuery({
    queryKey: roomQueryKeys.list(),
    queryFn: () =>
      fetchAppApi<RoomListItem[]>("/api/rooms", {
        cache: "no-store",
      }),
  });
  const columns = useMemo(
    () =>
      roomColumnHelper.columns([
        roomColumnHelper.accessor("name", {
          header: "Phòng",
          cell: (info) => (
            <div className="space-y-1">
              <Link
                href={`/rooms/${info.row.original.id}`}
                className="font-medium hover:underline"
              >
                {info.getValue()}
              </Link>
              <p className="text-xs text-muted-foreground">
                {info.row.original.nextAction}
              </p>
            </div>
          ),
          sortFn: "alphanumeric",
        }),
        roomColumnHelper.accessor("status", {
          header: "Trạng thái",
          cell: (info) => <RoomBadge status={info.getValue()} />,
          enableGlobalFilter: false,
          filterFn: "equalsString",
          sortFn: "alphanumeric",
        }),
        roomColumnHelper.accessor(
          (room) => room.keyTenantName ?? "Chưa có Key Tenant",
          {
            id: "keyTenantName",
            header: "Key Tenant",
            sortFn: "alphanumeric",
          },
        ),
        roomColumnHelper.accessor("roomBasePrice", {
          header: "Base rent",
          cell: (info) => (
            <span className="font-mono tabular-nums">
              {formatCurrency(info.getValue())}
            </span>
          ),
          enableGlobalFilter: false,
        }),
        roomColumnHelper.accessor("basePrice", {
          header: "Giá áp dụng",
          cell: (info) => (
            <span className="font-mono tabular-nums">
              {formatCurrency(info.getValue())}
            </span>
          ),
          enableGlobalFilter: false,
        }),
        roomColumnHelper.accessor("tenantCount", {
          header: "Người ở",
          cell: (info) => (
            <span className="font-mono tabular-nums">{info.getValue()}</span>
          ),
          enableGlobalFilter: false,
        }),
        roomColumnHelper.accessor(
          (room) => (room.activeContractId ? "Có" : "Chưa có"),
          {
            id: "activeContract",
            header: "Active Contract",
            sortFn: "alphanumeric",
          },
        ),
        roomColumnHelper.display({
          id: "actions",
          header: "Thao tác",
          cell: ({ row }) => (
            <div className="flex justify-end gap-2">
              <RoomEditorDialog mode="edit" room={row.original} />
              <Button asChild variant="secondary" size="sm">
                <Link href={`/rooms/${row.original.id}`}>Chi tiết</Link>
              </Button>
            </div>
          ),
          enableHiding: false,
          enableSorting: false,
        }),
      ]),
    [],
  );

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Quản lý phòng</p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Danh sách phòng trọ
          </h1>
          {/* <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Rooms được tải qua API nội bộ đã xác thực. Trạng thái phòng vẫn được
            tính từ active Contract, trừ khi phòng đang bảo trì.
          </p> */}
        </div>
        <RoomEditorDialog mode="create" />
      </header>

      <DataTable
        columns={columns}
        data={roomsQuery.data ?? []}
        emptyMessage="Tạo phòng đầu tiên để bắt đầu thêm Tenant, Contract và chốt chỉ số."
        emptyTitle="Chưa có phòng nào"
        errorMessage={roomsQuery.isError ? roomsQuery.error.message : undefined}
        filteredEmptyMessage="Thử đổi từ khóa search hoặc trạng thái phòng."
        filteredEmptyTitle="Không tìm thấy phòng"
        isFetching={roomsQuery.isFetching}
        isLoading={roomsQuery.isPending}
        onRetry={() => void roomsQuery.refetch()}
        searchPlaceholder="Tìm phòng hoặc Key Tenant..."
        statusFilter={{
          columnId: "status",
          label: "Lọc trạng thái",
          allLabel: "Tất cả trạng thái",
          options: [
            { value: "available", label: roomStatusLabel.available },
            { value: "occupied", label: roomStatusLabel.occupied },
            { value: "maintenance", label: roomStatusLabel.maintenance },
          ],
        }}
        // title="Danh sách phòng"
      />
    </>
  );
}

function RoomEditorDialog({
  mode,
  room,
}: {
  mode: "create" | "edit";
  room?: RoomListItem;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RoomDraft>(() => getInitialDraft(room));
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const validationMessage = useMemo(() => validateRoomDraft(draft), [draft]);
  const isEdit = mode === "edit";

  const mutation = useMutation<
    RoomListItem,
    AppApiClientError,
    {
      name: string;
      basePrice: number;
      status: RoomWriteStatus;
    }
  >({
    mutationFn: (payload) =>
      fetchAppApi<RoomListItem>(isEdit ? `/api/rooms/${room?.id}` : "/api/rooms", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (savedRoom) => {
      queryClient.setQueryData<RoomListItem[]>(roomQueryKeys.list(), (current) => {
        if (!current) {
          return [savedRoom];
        }

        const exists = current.some((item) => item.id === savedRoom.id);
        const next = exists
          ? current.map((item) => (item.id === savedRoom.id ? savedRoom : item))
          : [...current, savedRoom];

        return next.sort((left, right) => left.name.localeCompare(right.name));
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: roomQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
      ]);

      toast.success(isEdit ? "Đã cập nhật phòng." : "Đã tạo phòng mới.");
      setOpen(false);
    },
    onError: (error) => {
      setServerMessage(error.message);
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      setDraft(getInitialDraft(room));
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
      basePrice: Number.parseFloat(draft.basePrice),
      status: draft.status,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size={isEdit ? "sm" : "default"} variant={isEdit ? "outline" : "default"}>
          {isEdit ? "Cập nhật" : "Thêm phòng mới"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Cập nhật phòng" : "Thêm phòng mới"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Cập nhật tên, base rent hoặc chuyển phòng sang trạng thái bảo trì."
              : "Tạo phòng mới để bắt đầu quản lý Tenant, Contract và chốt chỉ số."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor={`room-name-${mode}-${room?.id ?? "new"}`}>Tên phòng</Label>
            <Input
              id={`room-name-${mode}-${room?.id ?? "new"}`}
              value={draft.name}
              placeholder="Room 201"
              disabled={mutation.isPending}
              onChange={(event) => {
                setDraft((current) => ({ ...current, name: event.target.value }));
                setServerMessage(null);
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`room-base-price-${mode}-${room?.id ?? "new"}`}>
              Base rent
            </Label>
            <Input
              id={`room-base-price-${mode}-${room?.id ?? "new"}`}
              type="number"
              min={0}
              step={1000}
              value={draft.basePrice}
              placeholder="3200000"
              disabled={mutation.isPending}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  basePrice: event.target.value,
                }));
                setServerMessage(null);
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`room-status-${mode}-${room?.id ?? "new"}`}>
              Trạng thái vận hành
            </Label>
            <Select
              value={draft.status}
              onValueChange={(value) => {
                setDraft((current) => ({
                  ...current,
                  status: value as RoomWriteStatus,
                }));
                setServerMessage(null);
              }}
              disabled={mutation.isPending}
            >
              <SelectTrigger id={`room-status-${mode}-${room?.id ?? "new"}`}>
                <SelectValue placeholder="Chọn trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Available">Trống nếu chưa có active Contract</SelectItem>
                <SelectItem value="Maintenance">Bảo trì</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Đang thuê được tính từ active Contract, không chọn thủ công ở đây.
            </p>
          </div>

          {(validationMessage || serverMessage) && (
            <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {serverMessage ?? validationMessage}
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
                : "Tạo phòng"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoomBadge({ status }: { status: RoomUiStatus }) {
  const variant =
    status === "available"
      ? "success"
      : status === "maintenance"
        ? "warning"
        : "secondary";

  return <Badge variant={variant}>{roomStatusLabel[status]}</Badge>;
}

function getInitialDraft(room?: RoomListItem): RoomDraft {
  if (!room) {
    return defaultRoomDraft;
  }

  return {
    name: room.name,
    basePrice: String(room.roomBasePrice),
    status: room.status === "maintenance" ? "Maintenance" : "Available",
  };
}

function validateRoomDraft(draft: RoomDraft) {
  if (!draft.name.trim()) {
    return "Nhập tên phòng.";
  }

  const basePrice = Number.parseFloat(draft.basePrice);

  if (!Number.isFinite(basePrice) || basePrice < 0) {
    return "Base rent phải là số không âm.";
  }

  return null;
}

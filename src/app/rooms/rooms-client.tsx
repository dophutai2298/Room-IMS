"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { Skeleton } from "@/components/ui/skeleton";
import { AppApiClientError, fetchAppApi } from "@/lib/api/client";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import { formatCurrency } from "@/lib/formatters";
import type { RoomWriteStatus } from "@/lib/rooms/repository";
import {
  roomStatusLabel,
  type RoomListItem,
  type RoomUiStatus,
} from "@/lib/rooms/presenter";
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

export function RoomsClient() {
  const roomsQuery = useQuery({
    queryKey: roomQueryKeys.list(),
    queryFn: () =>
      fetchAppApi<RoomListItem[]>("/api/rooms", {
        cache: "no-store",
      }),
  });

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Quản lý phòng</p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Danh sách phòng trọ
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Rooms được tải qua API nội bộ đã xác thực. Trạng thái phòng vẫn được
            tính từ active Contract, trừ khi phòng đang bảo trì.
          </p>
        </div>
        <RoomEditorDialog mode="create" />
      </header>

      {roomsQuery.isPending ? (
        <RoomsGridSkeleton />
      ) : roomsQuery.isError ? (
        <ErrorCard
          message={roomsQuery.error.message}
          onRetry={() => void roomsQuery.refetch()}
        />
      ) : roomsQuery.data.length === 0 ? (
        <EmptyRooms onRetry={() => void roomsQuery.refetch()} />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roomsQuery.data.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </section>
      )}
    </>
  );
}

function RoomCard({ room }: { room: RoomListItem }) {
  return (
    <Card className="h-full">
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{room.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {room.keyTenantName ?? "Chưa có Key Tenant"}
            </p>
          </div>
          <RoomBadge status={room.status} />
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/40 bg-background/35 p-4 clay-inset dark:border-white/8">
          <InfoBlock label="Giá đang áp dụng" value={formatCurrency(room.basePrice)} />
          <InfoBlock label="Base rent" value={formatCurrency(room.roomBasePrice)} />
          <InfoBlock label="Số người ở" value={`${room.tenantCount} người`} />
          <InfoBlock
            label="Active Contract"
            value={room.activeContractId ? "Có" : "Chưa có"}
          />
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Việc tiếp theo</span>
          <span className="text-right font-medium">{room.nextAction}</span>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <RoomEditorDialog mode="edit" room={room} />
          <Button asChild variant="secondary" size="sm">
            <Link href={`/rooms/${room.id}`}>Chi tiết</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
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

function RoomsGridSkeleton() {
  return (
    <section
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="space-y-5">
            <Skeleton className="h-6 w-36" />
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
            <Skeleton className="h-5 w-full" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function EmptyRooms({ onRetry }: { onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="rounded-[1.5rem] border border-dashed border-border bg-muted/25 p-8 text-center">
        <p className="text-lg font-semibold">Chưa có phòng nào</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Tạo phòng đầu tiên để bắt đầu thêm Tenant, Contract và chốt chỉ số.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <RoomEditorDialog mode="create" />
          <Button variant="secondary" onClick={onRetry}>
            Tải lại
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-destructive/20">
      <CardContent className="space-y-3">
        <Badge variant="destructive">Lỗi API</Badge>
        <h2 className="text-lg font-semibold">Không tải được danh sách phòng</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="secondary" onClick={onRetry}>
          Thử lại
        </Button>
      </CardContent>
    </Card>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums">{value}</p>
    </div>
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

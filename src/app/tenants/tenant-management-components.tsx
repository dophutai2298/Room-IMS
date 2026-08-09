"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { AppApiClientError, fetchAppApi } from "@/lib/api/client";
import { contractQueryKeys } from "@/lib/contracts/query-keys";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import { invoiceQueryKeys } from "@/lib/invoices/query-keys";
import { roomQueryKeys } from "@/lib/rooms/query-keys";
import {
  tenantStatusLabel,
  type TenantCccdImage,
  type TenantListItem,
} from "@/lib/tenants/presenter";
import type {
  DeleteTenantResult,
  TenantWriteStatus,
} from "@/lib/tenants/repository";
import { tenantQueryKeys } from "@/lib/tenants/query-keys";
import { cn } from "@/lib/utils";

export type TenantRoomOption = {
  id: string;
  name: string;
};

type TenantDraft = {
  roomId: string;
  name: string;
  phone: string;
  dateOfBirth: string;
  permanentAddress: string;
  cccdNumber: string;
  status: TenantWriteStatus;
};

const defaultTenantDraft: TenantDraft = {
  roomId: "",
  name: "",
  phone: "",
  dateOfBirth: "",
  permanentAddress: "",
  cccdNumber: "",
  status: "Active",
};

export function TenantEditorDialog({
  mode,
  tenant,
  fixedRoomId,
  rooms = [],
  triggerLabel,
  triggerSize = "default",
}: {
  mode: "create" | "edit";
  tenant?: TenantListItem;
  fixedRoomId?: string;
  rooms?: TenantRoomOption[];
  triggerLabel?: string;
  triggerSize?: "default" | "sm";
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TenantDraft>(() =>
    getInitialDraft({ tenant, fixedRoomId }),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const validationMessage = useMemo(
    () => validateTenantDraft({ draft, files, fixedRoomId }),
    [draft, files, fixedRoomId],
  );
  const isEdit = mode === "edit";

  const mutation = useMutation<
    TenantListItem,
    AppApiClientError,
    { draft: TenantDraft; files: File[] }
  >({
    mutationFn: async (payload) => {
      const roomId = fixedRoomId ?? payload.draft.roomId;
      const savedTenant = await fetchAppApi<TenantListItem>(
        isEdit ? `/api/tenants/${tenant?.id}` : fixedRoomId ? `/api/rooms/${roomId}/tenants` : "/api/tenants",
        {
          method: isEdit ? "PATCH" : "POST",
          body: JSON.stringify({
            roomId,
            name: payload.draft.name,
            phone: payload.draft.phone,
            dateOfBirth: payload.draft.dateOfBirth || null,
            permanentAddress: payload.draft.permanentAddress || null,
            cccdNumber: payload.draft.cccdNumber,
            status: payload.draft.status,
          }),
        },
      );

      if (payload.files.length === 0) {
        return savedTenant;
      }

      const formData = new FormData();
      for (const file of payload.files) {
        formData.append("images", file);
      }

      const uploadedImages = await fetchAppApi<TenantCccdImage[]>(
        `/api/tenants/${savedTenant.id}/cccd-images`,
        {
          method: "POST",
          body: formData,
        },
      );

      return {
        ...savedTenant,
        cccdImages: [...savedTenant.cccdImages, ...uploadedImages],
      };
    },
    onSuccess: async (savedTenant) => {
      const affectedRoomIds = [tenant?.roomId, fixedRoomId, savedTenant.roomId].filter(
        isNonEmptyString,
      );

      queryClient.setQueryData<TenantListItem>(
        tenantQueryKeys.detail(savedTenant.id),
        savedTenant,
      );

      await invalidateTenantDependents({
        queryClient,
        tenantId: savedTenant.id,
        roomIds: affectedRoomIds,
      });

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
      setDraft(getInitialDraft({ tenant, fixedRoomId }));
      setFiles([]);
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
    mutation.mutate({ draft, files });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size={triggerSize}
          variant={isEdit ? "outline" : "default"}
        >
          {triggerLabel ?? (isEdit ? "Cập nhật" : "Thêm Tenant")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Cập nhật Tenant" : "Thêm Tenant"}</DialogTitle>
          <DialogDescription>
            Lưu hồ sơ Tenant, CCCD và ảnh định danh qua API nội bộ trước khi ghi
            xuống InsForge.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {!fixedRoomId && (
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={`tenant-room-${mode}-${tenant?.id ?? "new"}`}>
                Phòng
              </Label>
              <Select
                value={draft.roomId}
                disabled={mutation.isPending}
                onValueChange={(value) => {
                  setDraft((current) => ({ ...current, roomId: value }));
                  setServerMessage(null);
                }}
              >
                <SelectTrigger id={`tenant-room-${mode}-${tenant?.id ?? "new"}`}>
                  <SelectValue placeholder="Chọn phòng cho Tenant" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <TenantTextField
            id={`tenant-name-${mode}-${tenant?.id ?? "new"}`}
            label="Họ tên"
            value={draft.name}
            placeholder="Nguyễn Văn A"
            disabled={mutation.isPending}
            required
            onChange={(value) => {
              setDraft((current) => ({ ...current, name: value }));
              setServerMessage(null);
            }}
          />

          <TenantTextField
            id={`tenant-phone-${mode}-${tenant?.id ?? "new"}`}
            label="Số điện thoại"
            value={draft.phone}
            placeholder="0900000000"
            disabled={mutation.isPending}
            required
            onChange={(value) => {
              setDraft((current) => ({ ...current, phone: value }));
              setServerMessage(null);
            }}
          />

          <TenantTextField
            id={`tenant-dob-${mode}-${tenant?.id ?? "new"}`}
            label="Ngày tháng năm sinh"
            value={draft.dateOfBirth}
            placeholder="22/02/1998"
            disabled={mutation.isPending}
            onChange={(value) => {
              setDraft((current) => ({ ...current, dateOfBirth: value }));
              setServerMessage(null);
            }}
          />

          <TenantTextField
            id={`tenant-cccd-${mode}-${tenant?.id ?? "new"}`}
            label="Số CCCD"
            value={draft.cccdNumber}
            placeholder="079000000001"
            disabled={mutation.isPending}
            required
            onChange={(value) => {
              setDraft((current) => ({ ...current, cccdNumber: value }));
              setServerMessage(null);
            }}
          />

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor={`tenant-address-${mode}-${tenant?.id ?? "new"}`}>
              Nơi thường trú
            </Label>
            <Textarea
              id={`tenant-address-${mode}-${tenant?.id ?? "new"}`}
              value={draft.permanentAddress}
              placeholder="Số nhà, phường/xã, quận/huyện, tỉnh/thành"
              disabled={mutation.isPending}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  permanentAddress: event.target.value,
                }));
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
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`tenant-cccd-images-${mode}-${tenant?.id ?? "new"}`}>
              Ảnh CCCD
            </Label>
            <Input
              id={`tenant-cccd-images-${mode}-${tenant?.id ?? "new"}`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              disabled={mutation.isPending}
              onChange={(event) => {
                setFiles(Array.from(event.target.files ?? []));
                setServerMessage(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Có thể chọn nhiều ảnh, tối đa 6 ảnh/lần và 5MB/ảnh.
            </p>
          </div>

          {(validationMessage || serverMessage) && (
            <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:col-span-2">
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
              ? files.length > 0
                ? "Đang lưu & upload..."
                : "Đang lưu..."
              : isEdit
                ? "Lưu thay đổi"
                : "Thêm Tenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TenantDeleteButton({
  tenant,
  size = "sm",
}: {
  tenant: TenantListItem;
  size?: "default" | "sm";
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation<DeleteTenantResult, AppApiClientError>({
    mutationFn: () =>
      fetchAppApi<DeleteTenantResult>(`/api/tenants/${tenant.id}`, {
        method: "DELETE",
      }),
    onSuccess: async (result) => {
      await invalidateTenantDependents({
        queryClient,
        tenantId: result.tenantId,
        roomIds: [result.roomId, tenant.roomId].filter(isNonEmptyString),
      });
      toast.success("Đã xoá Tenant.");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function handleDelete() {
    if (tenant.isKeyTenant) {
      toast.error("Tenant đang là Key Tenant của active Contract nên chưa thể xoá.");
      return;
    }

    const confirmed = window.confirm(
      `Xoá Tenant "${tenant.name}"? Hành động này không thể hoàn tác.`,
    );

    if (confirmed) {
      mutation.mutate();
    }
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size={size}
      disabled={mutation.isPending || tenant.isKeyTenant}
      onClick={handleDelete}
      title={
        tenant.isKeyTenant
          ? "Không thể xoá Tenant đang là Key Tenant của active Contract."
          : undefined
      }
    >
      {mutation.isPending ? "Đang xoá..." : "Xoá"}
    </Button>
  );
}

export function TenantStatusBadge({ status }: { status: TenantWriteStatus }) {
  return (
    <Badge variant={status === "Active" ? "success" : "outline"}>
      {tenantStatusLabel[status]}
    </Badge>
  );
}

export function TenantImageGallery({
  images,
  compact = false,
}: {
  images: TenantCccdImage[];
  compact?: boolean;
}) {
  if (images.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Chưa có ảnh CCCD.</p>
    );
  }

  return (
    <div className={cn("grid gap-3", compact ? "grid-cols-2" : "sm:grid-cols-3")}>
      {images.map((image, index) => (
        <a
          key={image.id}
          href={image.url}
          target="_blank"
          rel="noreferrer"
          className="group overflow-hidden rounded-2xl border border-white/45 bg-background/40 clay-inset dark:border-white/8"
        >
          <span
            className="block aspect-[4/3] bg-cover bg-center transition-transform group-hover:scale-[1.03]"
            style={{ backgroundImage: `url("${image.url}")` }}
            aria-label={`Ảnh CCCD ${index + 1}`}
          />
          <span className="block truncate px-3 py-2 text-xs text-muted-foreground">
            {image.fileName ?? `Ảnh CCCD ${index + 1}`}
          </span>
        </a>
      ))}
    </div>
  );
}

function TenantTextField({
  id,
  label,
  value,
  placeholder,
  disabled,
  required = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function getInitialDraft({
  tenant,
  fixedRoomId,
}: {
  tenant?: TenantListItem;
  fixedRoomId?: string;
}): TenantDraft {
  if (!tenant) {
    return {
      ...defaultTenantDraft,
      roomId: fixedRoomId ?? "",
    };
  }

  return {
    roomId: fixedRoomId ?? tenant.roomId ?? "",
    name: tenant.name,
    phone: tenant.phone ?? "",
    dateOfBirth: tenant.dateOfBirth ?? "",
    permanentAddress: tenant.permanentAddress ?? "",
    cccdNumber: tenant.cccdNumber ?? "",
    status: tenant.status,
  };
}

function validateTenantDraft({
  draft,
  files,
  fixedRoomId,
}: {
  draft: TenantDraft;
  files: File[];
  fixedRoomId?: string;
}) {
  if (!(fixedRoomId ?? draft.roomId).trim()) {
    return "Chọn phòng cho Tenant.";
  }

  if (!draft.name.trim()) {
    return "Nhập họ tên Tenant.";
  }

  if (!draft.phone.trim()) {
    return "Nhập số điện thoại Tenant.";
  }

  if (!draft.cccdNumber.trim()) {
    return "Nhập số CCCD.";
  }

  if (draft.status !== "Active" && draft.status !== "Moved Out") {
    return "Chọn trạng thái Tenant hợp lệ.";
  }

  if (files.length > 6) {
    return "Chỉ upload tối đa 6 ảnh CCCD mỗi lần.";
  }

  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) {
      return `Ảnh "${file.name}" lớn hơn 5MB.`;
    }

    if (!allowedImageTypes.has(file.type)) {
      return `Ảnh "${file.name}" không đúng định dạng.`;
    }
  }

  return null;
}

async function invalidateTenantDependents({
  queryClient,
  tenantId,
  roomIds,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  tenantId: string;
  roomIds: string[];
}) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: tenantQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: tenantQueryKeys.detail(tenantId) }),
    queryClient.invalidateQueries({ queryKey: roomQueryKeys.list() }),
    queryClient.invalidateQueries({ queryKey: contractQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
    ...roomIds.flatMap((roomId) => [
      queryClient.invalidateQueries({ queryKey: tenantQueryKeys.room(roomId) }),
      queryClient.invalidateQueries({ queryKey: roomQueryKeys.detail(roomId) }),
      queryClient.invalidateQueries({ queryKey: contractQueryKeys.room(roomId) }),
    ]),
  ]);
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

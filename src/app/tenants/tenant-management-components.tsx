"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
  DeleteTenantCccdImageResult,
  DeleteTenantResult,
  TenantWriteStatus,
} from "@/lib/tenants/repository";
import { tenantQueryKeys } from "@/lib/tenants/query-keys";
import { cn } from "@/lib/utils";
import { DateField } from "../rooms/[id]/contract-management-card"; // TODO move file to common component

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

type TenantImagePreview = {
  id: string;
  tenantId: string;
  url: string;
  storageKey: null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: null;
  source: "preview";
  file: File;
};

type TenantGalleryImage = TenantCccdImage | TenantImagePreview;

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
  const [selectedFilePreviews, setSelectedFilePreviews] = useState<
    TenantImagePreview[]
  >([]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const selectedFiles = useMemo(
    () => selectedFilePreviews.map((preview) => preview.file),
    [selectedFilePreviews],
  );
  const validationMessage = useMemo(
    () => validateTenantDraft({ draft, files: selectedFiles, fixedRoomId }),
    [draft, fixedRoomId, selectedFiles],
  );
  const existingImages = useMemo(
    () =>
      (tenant?.cccdImages ?? []).filter((image) => !deletedImageIds.includes(image.id)),
    [deletedImageIds, tenant?.cccdImages],
  );
  const galleryImages = useMemo<TenantGalleryImage[]>(
    () => [...existingImages, ...selectedFilePreviews],
    [existingImages, selectedFilePreviews],
  );
  const imagesPendingDelete = useMemo(
    () =>
      (tenant?.cccdImages ?? []).filter(
        (image) => image.source === "storage" && deletedImageIds.includes(image.id),
      ),
    [deletedImageIds, tenant?.cccdImages],
  );
  const isEdit = mode === "edit";

  const mutation = useMutation<
    TenantListItem,
    AppApiClientError,
    {
      draft: TenantDraft;
      files: File[];
      imagesToDelete: TenantCccdImage[];
    }
  >({
    mutationFn: async (payload) => {
      const roomId = fixedRoomId ?? payload.draft.roomId;
      const savedTenant = await fetchAppApi<TenantListItem>(
        isEdit
          ? `/api/tenants/${tenant?.id}`
          : fixedRoomId
            ? `/api/rooms/${roomId}/tenants`
            : "/api/tenants",
        {
          method: isEdit ? "PATCH" : "POST",
          body: JSON.stringify({
            roomId,
            name: payload.draft.name,
            phone: payload.draft.phone,
            dateOfBirth: payload.draft.dateOfBirth || null,
            permanentAddress: payload.draft.permanentAddress || null,
            cccdNumber: payload.draft.cccdNumber,
            status: isEdit ? payload.draft.status : "Active",
          }),
        },
      );

      let uploadedImages: TenantCccdImage[] = [];

      if (payload.files.length > 0) {
        const formData = new FormData();
        for (const file of payload.files) {
          formData.append("images", file);
        }

        uploadedImages = await fetchAppApi<TenantCccdImage[]>(
          `/api/tenants/${savedTenant.id}/cccd-images`,
          {
            method: "POST",
            body: formData,
          },
        );
      }

      for (const image of payload.imagesToDelete) {
        await fetchAppApi<DeleteTenantCccdImageResult>(
          `/api/tenants/${image.tenantId}/cccd-images/${image.id}`,
          {
            method: "DELETE",
          },
        );
      }

      return {
        ...savedTenant,
        cccdImages: [
          ...savedTenant.cccdImages.filter(
            (image) =>
              !payload.imagesToDelete.some(
                (deletedImage) => deletedImage.id === image.id,
              ),
          ),
          ...uploadedImages,
        ],
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

      toast.success(isEdit ? "Đã cập nhật Người thuê." : "Đã thêm Người thuê.");
      resetImageDraft();
      setOpen(false);
    },
    onError: (error) => {
      setServerMessage(error.message);
    },
  });

  function resetImageDraft() {
    setSelectedFilePreviews((current) => {
      revokePreviewUrls(current);
      return [];
    });
    setDeletedImageIds([]);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      setDraft(getInitialDraft({ tenant, fixedRoomId }));
      resetImageDraft();
      setServerMessage(null);
      mutation.reset();
      return;
    }

    resetImageDraft();
  }

  function handleFilesSelected(files: File[]) {
    setSelectedFilePreviews((current) => {
      revokePreviewUrls(current);

      return files.map((file) => ({
        id: `preview-${crypto.randomUUID()}`,
        tenantId: tenant?.id ?? "new",
        url: URL.createObjectURL(file),
        storageKey: null,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        uploadedAt: null,
        source: "preview",
        file,
      }));
    });
    setServerMessage(null);
  }

  function stageImageRemoval(image: TenantGalleryImage) {
    if (image.source === "preview") {
      setSelectedFilePreviews((current) => {
        const removed = current.find((preview) => preview.id === image.id);
        if (removed) {
          URL.revokeObjectURL(removed.url);
        }

        return current.filter((preview) => preview.id !== image.id);
      });
      setServerMessage(null);
      return;
    }

    if (image.source === "storage") {
      setDeletedImageIds((current) =>
        current.includes(image.id) ? current : [...current, image.id],
      );
      setServerMessage(null);
    }
  }

  function handleSubmit() {
    if (validationMessage || mutation.isPending) {
      setServerMessage(validationMessage);
      return;
    }

    setServerMessage(null);
    mutation.mutate({
      draft,
      files: selectedFiles,
      imagesToDelete: imagesPendingDelete,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size={triggerSize} variant={isEdit ? "outline" : "default"}>
          {triggerLabel ?? (isEdit ? "Cập nhật" : "Thêm")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Cập nhật Người thuê" : "Thêm Người thuê"}
          </DialogTitle>
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
                  <SelectValue placeholder="Chọn phòng cho Người thuê" />
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

          <DateField
            id={`tenant-dob-${mode}-${tenant?.id ?? "new"}`}
            label="Ngày tháng năm sinh"
            value={draft.dateOfBirth}
            // placeholder="22/02/1998"
            // disabled={mutation.isPending}
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

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor={`tenant-cccd-images-${mode}-${tenant?.id ?? "new"}`}>
              Ảnh Hồ sơ
            </Label>
            <Input
              id={`tenant-cccd-images-${mode}-${tenant?.id ?? "new"}`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              disabled={mutation.isPending}
              onChange={(event) => {
                handleFilesSelected(Array.from(event.target.files ?? []));
                event.currentTarget.value = "";
              }}
            />
            <p className="text-xs text-muted-foreground">
              Có thể chọn nhiều ảnh, tối đa 4 ảnh/lần và 5MB/ảnh. Ảnh mới và ảnh
              xoá chỉ được đồng bộ khi bấm Lưu thay đổi.
            </p>
            <TenantImageGallery
              images={galleryImages}
              allowDelete={true}
              onDeleteImage={stageImageRemoval}
            />
          </div>

          {isEdit && (
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
          )}

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
            onClick={() => handleOpenChange(false)}
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
              ? selectedFiles.length > 0 || imagesPendingDelete.length > 0
                ? "Đang lưu ảnh..."
                : "Đang lưu..."
              : isEdit
                ? "Lưu thay đổi"
                : "Thêm Người thuê"}
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
  const [open, setOpen] = useState(false);
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
      toast.success("Đã xoá thành công.");
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function handleDelete() {
    if (tenant.isKeyTenant) {
      toast.error(
        `${tenant.name} đang là người thuê chính của phòng ${tenant.roomName} nên chưa thể xoá.`,
      );
      return;
    }

    mutation.mutate();
  }

  return (
    <DeleteConfirmationDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          mutation.reset();
        }
      }}
      trigger={
        <Button
          type="button"
          variant="destructive"
          size={size}
          disabled={mutation.isPending || tenant.isKeyTenant}
          title={
            tenant.isKeyTenant
              ? "Không thể xoá Người thuê đại diện của Hợp đồng đang hiệu lực."
              : undefined
          }
        >
          {mutation.isPending ? "Đang xoá..." : "Xoá"}
        </Button>
      }
      title={`Xoá "${tenant.name}"?`}
      description="Hành động này không thể hoàn tác. Người này sẽ bị xoá khỏi danh sách và các màn hình liên quan sẽ được tải lại."
      isPending={mutation.isPending}
      errorMessage={mutation.isError ? mutation.error.message : undefined}
      onConfirm={handleDelete}
    />
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
  allowDelete = false,
  onDeleteImage,
}: {
  images: TenantGalleryImage[];
  compact?: boolean;
  allowDelete?: boolean;
  onDeleteImage?: (image: TenantGalleryImage) => void;
}) {
  if (images.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Chưa có ảnh hồ sơ.</p>
    );
  }

  return (
   <div className={cn("grid gap-3 grid-cols-2", compact ? "grid-cols-2" : "md:grid-cols-3")}>
      {images.map((image, index) => {
        const canDelete = allowDelete && image.source !== "legacy" && onDeleteImage;
        console.log("allowDelete::",allowDelete)
          console.log("image.source::",image.source)
        return (
          <div
            key={image.id}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-white/45 bg-background/40 clay-inset dark:border-white/8",
              image.source === "preview" && "ring-2 ring-primary/35",
            )}
          >
            <a
              href={image.url}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <span
                className="block aspect-[4/3] bg-cover bg-center transition-transform group-hover:scale-[1.03]"
                style={{ backgroundImage: `url("${image.url}")` }}
                aria-label={`Ảnh hồ sơ ${index + 1}`}
              />
              <span className="block truncate px-3 py-2 text-xs text-muted-foreground">
                {image.fileName ?? `Ảnh hồ sơ ${index + 1}`}
                {image.source === "preview" ? " • Chưa lưu" : ""}
              </span>
            </a>
            {canDelete && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="absolute right-2 top-2 h-8 w-8 rounded-full p-0 shadow-lg"
                aria-label={`Xoá ảnh hồ sơ ${index + 1}`}
                onClick={() => onDeleteImage(image)}
              >
                ×
              </Button>
            )}
          </div>
        );
      })}
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
    return "Chọn phòng cho Người thuê.";
  }

  if (!draft.name.trim()) {
    return "Nhập họ tên Người thuê.";
  }

  if (!draft.phone.trim()) {
    return "Nhập số điện thoại Người thuê.";
  }

  if (!draft.cccdNumber.trim()) {
    return "Nhập số CCCD.";
  }

  if (draft.status !== "Active" && draft.status !== "Moved Out") {
    return "Chọn trạng thái Người thuê hợp lệ.";
  }

  if (files.length > 4) {
    return "Chỉ upload tối đa 4 ảnh hồ sơ mỗi lần.";
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

function revokePreviewUrls(previews: TenantImagePreview[]) {
  for (const preview of previews) {
    URL.revokeObjectURL(preview.url);
  }
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

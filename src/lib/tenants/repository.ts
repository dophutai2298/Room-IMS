import type { AppResult } from "@/lib/insforge/errors";
import type { TenantDbStatus } from "@/lib/insforge/types";
import type { TenantCccdImage, TenantListItem } from "./presenter";

export type TenantWriteStatus = TenantDbStatus;

export type WriteTenantInput = {
  roomId: string;
  name: string;
  phone: string;
  dateOfBirth: string | null;
  permanentAddress: string | null;
  cccdNumber: string;
  status: TenantWriteStatus;
};

export type UpdateTenantInput = WriteTenantInput & {
  tenantId: string;
};

export type ListTenantsInput = {
  search?: string | null;
};

export type DeleteTenantResult = {
  tenantId: string;
  roomId: string | null;
};

export type UploadTenantCccdImagesInput = {
  tenantId: string;
  images: File[];
};

export type DeleteTenantCccdImageInput = {
  tenantId: string;
  imageId: string;
};

export type DeleteTenantCccdImageResult = {
  tenantId: string;
  imageId: string;
};

export type TenantRepository = {
  listTenants(input?: ListTenantsInput): Promise<AppResult<TenantListItem[]>>;
  listRoomTenants(roomId: string): Promise<AppResult<TenantListItem[]>>;
  readTenant(tenantId: string): Promise<AppResult<TenantListItem>>;
  createTenant(input: WriteTenantInput): Promise<AppResult<TenantListItem>>;
  updateTenant(input: UpdateTenantInput): Promise<AppResult<TenantListItem>>;
  deleteTenant(tenantId: string): Promise<AppResult<DeleteTenantResult>>;
  uploadTenantCccdImages(
    input: UploadTenantCccdImagesInput,
  ): Promise<AppResult<TenantCccdImage[]>>;
  deleteTenantCccdImage(
    input: DeleteTenantCccdImageInput,
  ): Promise<AppResult<DeleteTenantCccdImageResult>>;
};

export type AppRole = "landlord" | "staff";
export type AppUserStatus = "active" | "disabled";
export type RoomDbStatus = "Available" | "Occupied" | "Maintenance";
export type TenantDbStatus = "Active" | "Moved Out";
export type ContractDbStatus = "Active" | "Terminated";
export type InvoiceDbStatus = "Unpaid" | "Partially Paid" | "Paid";

export type AppUser = {
  id: string;
  authUserId: string;
  email: string;
  displayName: string;
  role: AppRole;
  status?: AppUserStatus;
};

export type RoomRecord = {
  id: string;
  name: string;
  status: RoomDbStatus;
  base_price: number;
  created_at: string;
  updated_at: string;
};

export type TenantRecord = {
  id: string;
  room_id: string | null;
  full_name: string;
  phone: string | null;
  date_of_birth?: string | null;
  permanent_address?: string | null;
  cccd_number?: string | null;
  is_key_tenant: boolean;
  cccd_front_url?: string | null;
  cccd_back_url?: string | null;
  status: TenantDbStatus;
};

export type TenantCccdImageRecord = {
  id: string;
  tenant_id: string;
  storage_key: string;
  public_url: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
};

export type ContractRecord = {
  id: string;
  room_id: string;
  key_tenant_id: string;
  deposit_amount: number;
  start_date: string;
  end_date: string | null;
  status: ContractDbStatus;
  rent_amount: number | null;
  electricity_price_override: number | null;
  water_price_override: number | null;
};

export type UtilityMetricRecord = {
  id: string;
  room_id: string;
  month: number;
  year: number;
  electricity_old: number;
  electricity_new: number;
  water_old: number;
  water_new: number;
};

export type UtilityPricingRecord = {
  id: string;
  effective_from: string;
  electricity_unit_price: number;
  water_unit_price: number;
  is_active: boolean;
};

export type InvoiceRecord = {
  id: string;
  room_id: string;
  month: number;
  year: number;
  room_fee: number;
  electricity_fee: number;
  water_fee: number;
  other_fee: number;
  other_fee_note: string | null;
  total_amount: number;
  amount_paid: number;
  status: InvoiceDbStatus;
};

export type MvpSeededData = {
  rooms: RoomRecord[];
  tenants: TenantRecord[];
  contracts: ContractRecord[];
  utilityMetrics: UtilityMetricRecord[];
  utilityPricing: UtilityPricingRecord[];
  invoices: InvoiceRecord[];
};

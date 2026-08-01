export type RoomStatus = "occupied" | "available" | "maintenance";
export type InvoiceStatus = "unpaid" | "partial" | "paid";

export const rooms = [
  {
    id: "101",
    name: "Phòng 101",
    status: "occupied" as RoomStatus,
    rent: 3200000,
    tenants: 2,
    keyTenant: "Nguyễn Minh Khoa",
    lastUtilityPeriod: "07/2026",
    nextAction: "Chốt điện nước tháng 8",
  },
  {
    id: "102",
    name: "Phòng 102",
    status: "available" as RoomStatus,
    rent: 2800000,
    tenants: 0,
    keyTenant: null,
    lastUtilityPeriod: null,
    nextAction: "Sẵn sàng cho thuê",
  },
  {
    id: "103",
    name: "Phòng 103",
    status: "occupied" as RoomStatus,
    rent: 3500000,
    tenants: 3,
    keyTenant: "Lê Thanh Huyền",
    lastUtilityPeriod: "07/2026",
    nextAction: "Chưa thu tiền",
  },
  {
    id: "104",
    name: "Phòng 104",
    status: "maintenance" as RoomStatus,
    rent: 2600000,
    tenants: 0,
    keyTenant: null,
    lastUtilityPeriod: null,
    nextAction: "Kiểm tra bảo trì",
  },
  {
    id: "105",
    name: "Phòng 105",
    status: "occupied" as RoomStatus,
    rent: 3000000,
    tenants: 1,
    keyTenant: "Phạm Gia Bảo",
    lastUtilityPeriod: "06/2026",
    nextAction: "Thiếu chỉ số tháng 7",
  },
];

export const tenants = [
  {
    id: "tenant-1",
    roomId: "101",
    name: "Nguyễn Minh Khoa",
    phone: "0908 421 739",
    role: "Key Tenant",
    identityStatus: "Đã lưu URL CCCD",
  },
  {
    id: "tenant-2",
    roomId: "101",
    name: "Trần Ngọc Mai",
    phone: "0916 284 503",
    role: "Tenant",
    identityStatus: "Thiếu mặt sau CCCD",
  },
];

export const utilityReadings = {
  roomId: "101",
  period: "08/2026",
  electricity: {
    previous: 1050,
    current: "",
    unit: "kWh",
    price: 3900,
  },
  water: {
    previous: 120,
    current: "",
    unit: "m³",
    price: 18000,
  },
};

export const invoices = [
  {
    id: "INV-2608-001",
    room: "Phòng 101",
    period: "08/2026",
    rent: 3200000,
    utilities: 603500,
    otherFees: 0,
    total: 3803500,
    amountPaid: 0,
    status: "unpaid" as InvoiceStatus,
  },
  {
    id: "INV-2608-002",
    room: "Phòng 102",
    period: "08/2026",
    rent: 2800000,
    utilities: 150000,
    otherFees: 0,
    total: 2950000,
    amountPaid: 2950000,
    status: "paid" as InvoiceStatus,
  },
  {
    id: "INV-2608-003",
    room: "Phòng 103",
    period: "08/2026",
    rent: 3500000,
    utilities: 420000,
    otherFees: 0,
    total: 3920000,
    amountPaid: 1500000,
    status: "partial" as InvoiceStatus,
  },
];

export const revenueTrend = [
  { period: "Thg 3", billed: 13850000, collected: 12600000 },
  { period: "Thg 4", billed: 14280000, collected: 13950000 },
  { period: "Thg 5", billed: 15120000, collected: 14420000 },
  { period: "Thg 6", billed: 14860000, collected: 14100000 },
  { period: "Thg 7", billed: 15980000, collected: 15150000 },
  { period: "Thg 8", billed: 16740000, collected: 15187000 },
];

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

export const roomStatusLabel: Record<RoomStatus, string> = {
  occupied: "Đang thuê",
  available: "Trống",
  maintenance: "Bảo trì",
};

export const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  unpaid: "Chưa thanh toán",
  partial: "Thanh toán một phần",
  paid: "Đã thanh toán",
};

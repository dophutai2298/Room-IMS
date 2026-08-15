"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
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
import {
  compareContracts,
  contractStatusLabel,
  type ContractListItem,
} from "@/lib/contracts/presenter";
import { contractQueryKeys } from "@/lib/contracts/query-keys";
import type { ContractWriteValues } from "@/lib/contracts/repository";
import { createDataTableColumnHelper } from "@/lib/data-table/tanstack";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import { formatCurrency } from "@/lib/formatters";
import type { ContractDbStatus } from "@/lib/insforge/types";
import { invoiceQueryKeys } from "@/lib/invoices/query-keys";
import { roomQueryKeys } from "@/lib/rooms/query-keys";
import type { TenantListItem } from "@/lib/tenants/presenter";
import { tenantQueryKeys } from "@/lib/tenants/query-keys";

const contractColumnHelper = createDataTableColumnHelper<ContractListItem>();

export function ContractManagementCard({
  roomId,
  roomName,
  roomBasePrice,
}: {
  roomId: string;
  roomName: string;
  roomBasePrice: number;
}) {
  const contractsQuery = useQuery({
    queryKey: contractQueryKeys.room(roomId),
    queryFn: () =>
      fetchAppApi<ContractListItem[]>(`/api/rooms/${roomId}/contracts`, {
        cache: "no-store",
      }),
  });
  const tenantsQuery = useQuery({
    queryKey: tenantQueryKeys.room(roomId),
    queryFn: () =>
      fetchAppApi<TenantListItem[]>(`/api/rooms/${roomId}/tenants`, {
        cache: "no-store",
      }),
  });

  if (contractsQuery.isPending) {
    return <ContractCardSkeleton />;
  }

  if (contractsQuery.isError) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle>Thông tin Hợp đồng</CardTitle>
          <CardDescription>Không tải được dữ liệu Hợp đồng.</CardDescription>
        </CardHeader>
        <CardContent>
          <ContractErrorState
            message={contractsQuery.error.message}
            onRetry={() => void contractsQuery.refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  const contracts = contractsQuery.data;
  const activeContract = contracts.find((contract) => contract.status === "Active");
  const historicalContracts = contracts.filter(
    (contract) => contract.status === "Terminated",
  );
  const tenants = tenantsQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Thông tin Hợp đồng</CardTitle>
            <CardDescription>
              Hợp đồng quyết định trạng thái thuê và bảng giá riêng của phòng.
            </CardDescription>
          </div>
          {!activeContract && (
            <ContractEditorDialog
              mode="create"
              roomId={roomId}
              roomName={roomName}
              roomBasePrice={roomBasePrice}
              tenants={tenants}
              tenantsPending={tenantsQuery.isPending}
              tenantsError={tenantsQuery.error?.message}
              onRetryTenants={() => void tenantsQuery.refetch()}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {activeContract ? (
          <ContractSummary
            contract={activeContract}
            label="Active Contract"
            action={
              <ContractEditorDialog
                mode="edit"
                roomId={roomId}
                roomName={roomName}
                roomBasePrice={roomBasePrice}
                contract={activeContract}
                tenants={tenants}
                tenantsPending={tenantsQuery.isPending}
                tenantsError={tenantsQuery.error?.message}
                onRetryTenants={() => void tenantsQuery.refetch()}
              />
            }
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6">
            <p className="font-medium">Chưa có Hợp đồng</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tạo Hợp đồng sau khi phòng đã có ít nhất một Người đang ở. Phòng sẽ
              được tính là Trống nếu không trong trạng thái Bảo trì.
            </p>
          </div>
        )}

        {tenantsQuery.isError && (
          <ContractErrorState
            message={`Không tải được Danh sách người thuê để chọn Người đại diện: ${tenantsQuery.error.message}`}
            onRetry={() => void tenantsQuery.refetch()}
          />
        )}

        {historicalContracts.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <div>
                <p className="font-medium">Lịch sử Hợp đồng</p>
                <p className="text-sm text-muted-foreground">
                  Các hợp đồng đã kết thúc vẫn giữ nguyên Người đại diện và giá tiện ích.
                </p>
              </div>
              <ContractHistoryTable
                contracts={historicalContracts}
                onRetryTenants={() => void tenantsQuery.refetch()}
                roomBasePrice={roomBasePrice}
                roomId={roomId}
                roomName={roomName}
                tenants={tenants}
                tenantsError={tenantsQuery.error?.message}
                tenantsPending={tenantsQuery.isPending}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ContractSummary({
  contract,
  label,
  action,
}: {
  contract: ContractListItem;
  label: string;
  action: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="success">{label}</Badge>
        {action}
      </div>
      <DetailRow label="Trạng thái" value={contractStatusLabel[contract.status]} />
      <DetailRow label="Giá thuê" value={`${formatCurrency(contract.rentAmount)} / tháng`} />
      <DetailRow label="Tiền cọc" value={formatCurrency(contract.depositAmount)} />
      <DetailRow label="Người đại diện" value={contract.keyTenantName} />
      <DetailRow label="Ngày bắt đầu" value={formatDate(contract.startDate)} />
      <DetailRow
        label="Ngày kết thúc"
        value={contract.endDate ? formatDate(contract.endDate) : "Không có"}
      />
      <Separator />
      <DetailRow
        label="Giá điện riêng"
        value={formatOptionalUnitPrice(contract.electricityPriceOverride, "kWh")}
      />
      <DetailRow
        label="Giá nước riêng"
        value={formatOptionalUnitPrice(contract.waterPriceOverride, "m³")}
      />
    </div>
  );
}

function ContractHistoryTable({
  contracts,
  onRetryTenants,
  roomBasePrice,
  roomId,
  roomName,
  tenants,
  tenantsError,
  tenantsPending,
}: {
  contracts: ContractListItem[];
  onRetryTenants: () => void;
  roomBasePrice: number;
  roomId: string;
  roomName: string;
  tenants: TenantListItem[];
  tenantsError?: string;
  tenantsPending: boolean;
}) {
  const columns = useMemo(
    () =>
      contractColumnHelper.columns([
        contractColumnHelper.accessor("keyTenantName", {
          header: "Người đại diện",
          cell: (info) => <span className="font-medium">{info.getValue()}</span>,
          sortFn: "alphanumeric",
        }),
        contractColumnHelper.accessor("startDate", {
          header: "Thời hạn",
          cell: (info) => {
            const contract = info.row.original;

            return (
              <span>
                {formatDate(contract.startDate)} -{" "}
                {contract.endDate ? formatDate(contract.endDate) : "Không có"}
              </span>
            );
          },
          sortFn: "datetime",
        }),
        contractColumnHelper.accessor("rentAmount", {
          header: "Giá thuê",
          cell: (info) => (
            <span className="font-mono tabular-nums">
              {formatCurrency(info.getValue())} / tháng
            </span>
          ),
          enableGlobalFilter: false,
        }),
        contractColumnHelper.accessor("depositAmount", {
          header: "Tiền cọc",
          cell: (info) => (
            <span className="font-mono tabular-nums">
              {formatCurrency(info.getValue())}
            </span>
          ),
          enableGlobalFilter: false,
        }),
        contractColumnHelper.accessor("status", {
          header: "Trạng thái",
          cell: (info) => (
            <Badge variant="secondary">{contractStatusLabel[info.getValue()]}</Badge>
          ),
          enableGlobalFilter: false,
          filterFn: "equalsString",
          sortFn: "alphanumeric",
        }),
        contractColumnHelper.display({
          id: "actions",
          header: "Thao tác",
          cell: ({ row }) => (
            <div className="flex justify-end">
              <ContractEditorDialog
                mode="edit"
                roomId={roomId}
                roomName={roomName}
                roomBasePrice={roomBasePrice}
                contract={row.original}
                tenants={tenants}
                tenantsPending={tenantsPending}
                tenantsError={tenantsError}
                onRetryTenants={onRetryTenants}
              />
            </div>
          ),
          enableHiding: false,
          enableSorting: false,
        }),
      ]),
    [
      onRetryTenants,
      roomBasePrice,
      roomId,
      roomName,
      tenants,
      tenantsError,
      tenantsPending,
    ],
  );

  return (
    <DataTable
      columns={columns}
      data={contracts}
      filteredEmptyMessage="Thử đổi từ khóa search hoặc trạng thái hợp đồng."
      filteredEmptyTitle="Không tìm thấy hợp đồng"
      searchPlaceholder="Tìm người đại diện hoặc ngày..."
      statusFilter={{
        columnId: "status",
        label: "Lọc trạng thái",
        allLabel: "Tất cả trạng thái",
        options: [{ value: "Terminated", label: contractStatusLabel.Terminated }],
      }}
      variant="plain"
    />
  );
}

type ContractEditorDialogProps = {
  roomId: string;
  roomName: string;
  roomBasePrice: number;
  tenants: TenantListItem[];
  tenantsPending: boolean;
  tenantsError?: string;
  onRetryTenants: () => void;
} & (
  | { mode: "create"; contract?: never }
  | { mode: "edit"; contract: ContractListItem }
);

function ContractEditorDialog(props: ContractEditorDialogProps) {
  const {
    mode,
    roomId,
    roomName,
    roomBasePrice,
    tenants,
    tenantsPending,
    tenantsError,
    onRetryTenants,
  } = props;
  const contract = props.mode === "edit" ? props.contract : undefined;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ContractDraft>(() =>
    getInitialDraft({ contract, roomBasePrice }),
  );
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const isEdit = mode === "edit";
  const selectableTenants = useMemo(
    () =>
      tenants.filter(
        (tenant) =>
          tenant.status === "Active" || tenant.id === contract?.keyTenantId,
      ),
    [contract?.keyTenantId, tenants],
  );
  const validationMessage = useMemo(
    () => validateContractDraft(draft),
    [draft],
  );

  const mutation = useMutation<
    ContractListItem,
    AppApiClientError,
    ContractMutationPayload
  >({
    mutationFn: (payload) =>
      fetchAppApi<ContractListItem>(
        props.mode === "edit"
          ? `/api/contracts/${props.contract.id}`
          : `/api/rooms/${roomId}/contracts`,
        {
          method: isEdit ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: async (savedContract) => {
      queryClient.setQueryData<ContractListItem[]>(
        contractQueryKeys.room(roomId),
        (current) => upsertContract(current ?? [], savedContract),
      );
      await invalidateContractDependents({
        queryClient,
        roomId,
      });

      toast.success(isEdit ? "Đã cập nhật Hợp đồng." : "Đã tạo Hợp đồng.");
      setOpen(false);
      setServerMessage(null);
    },
    onError: (error) => setServerMessage(error.message),
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      setDraft(getInitialDraft({ contract, roomBasePrice }));
      setServerMessage(null);
      mutation.reset();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (validationMessage) {
      setServerMessage(validationMessage);
      return;
    }

    setServerMessage(null);
    mutation.mutate(toMutationPayload(draft, isEdit));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={isEdit ? "secondary" : "default"} size="sm">
          {isEdit ? "Chỉnh sửa" : "Tạo Hợp đồng"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Cập nhật Hợp đồng" : "Tạo Hợp đồng"}</DialogTitle>
          <DialogDescription>
            {roomName}: chọn Người đại diện cùng phòng và cấu hình giá thuê, tiền cọc,
            thời hạn cùng giá tiện ích riêng nếu có.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`${mode}-key-tenant`}>Key Tenant *</Label>
            <Select
              value={draft.keyTenantId || undefined}
              onValueChange={(value) =>
                setDraft((current) => ({ ...current, keyTenantId: value }))
              }
              disabled={tenantsPending || Boolean(tenantsError)}
            >
              <SelectTrigger id={`${mode}-key-tenant`}>
                <SelectValue
                  placeholder={tenantsPending ? "Đang tải Tenant..." : "Chọn Tenant đang ở"}
                />
              </SelectTrigger>
              <SelectContent>
                {selectableTenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!tenantsPending && !tenantsError && selectableTenants.length === 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Hãy thêm ít nhất một Tenant đang ở trước khi tạo Contract.
              </p>
            )}
            {tenantsError && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{tenantsError}</p>
                <Button type="button" size="sm" variant="secondary" onClick={onRetryTenants}>
                  Thử lại
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              id={`${mode}-rent-amount`}
              label="Giá thuê / tháng *"
              value={draft.rentAmount}
              onChange={(value) => setDraft((current) => ({ ...current, rentAmount: value }))}
            />
            <MoneyField
              id={`${mode}-deposit-amount`}
              label="Tiền cọc *"
              value={draft.depositAmount}
              onChange={(value) => setDraft((current) => ({ ...current, depositAmount: value }))}
            />
            <DateField
              id={`${mode}-start-date`}
              label="Ngày bắt đầu *"
              value={draft.startDate}
              onChange={(value) => setDraft((current) => ({ ...current, startDate: value }))}
            />
            <DateField
              id={`${mode}-end-date`}
              label="Ngày kết thúc"
              value={draft.endDate}
              onChange={(value) => setDraft((current) => ({ ...current, endDate: value }))}
            />
          </div>

          <div className="rounded-2xl border border-white/45 bg-muted/25 p-4 clay-inset dark:border-white/8">
            <p className="font-medium">Giá tiện ích riêng</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Để trống để hóa đơn dùng bảng Utility Pricing đang áp dụng.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <MoneyField
                id={`${mode}-electricity-override`}
                label="Giá điện / kWh"
                value={draft.electricityPriceOverride}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    electricityPriceOverride: value,
                  }))
                }
                optional
              />
              <MoneyField
                id={`${mode}-water-override`}
                label="Giá nước / m³"
                value={draft.waterPriceOverride}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, waterPriceOverride: value }))
                }
                optional
              />
            </div>
          </div>

          {isEdit && (
            <div className="space-y-2">
              <Label htmlFor={`${mode}-status`}>Trạng thái</Label>
              <Select
                value={draft.status}
                onValueChange={(value: ContractDbStatus) =>
                  setDraft((current) => ({ ...current, status: value }))
                }
              >
                <SelectTrigger id={`${mode}-status`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Hiệu lực</SelectItem>
                  <SelectItem value="Terminated">Đã kết thúc</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {serverMessage && (
            <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {serverMessage}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                tenantsPending ||
                Boolean(tenantsError) ||
                selectableTenants.length === 0
              }
            >
              {mutation.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
  optional = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min="0"
        step="1"
        inputMode="decimal"
        value={value}
        placeholder={optional ? "Dùng bảng giá chung" : "0"}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
}

export function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
}

function ContractCardSkeleton() {
  return (
    <Card aria-busy="true" aria-live="polite">
      <CardHeader>
        <CardTitle>Thông tin Hợp đồng</CardTitle>
        <Skeleton className="h-4 w-72 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-6 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

function ContractErrorState({
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

type ContractDraft = {
  keyTenantId: string;
  depositAmount: string;
  rentAmount: string;
  electricityPriceOverride: string;
  waterPriceOverride: string;
  startDate: string;
  endDate: string;
  status: ContractDbStatus;
};

type ContractMutationPayload = ContractWriteValues & {
  status?: ContractDbStatus;
};

function getInitialDraft({
  contract,
  roomBasePrice,
}: {
  contract?: ContractListItem;
  roomBasePrice: number;
}): ContractDraft {
  return {
    keyTenantId: contract?.keyTenantId ?? "",
    depositAmount: String(contract?.depositAmount ?? roomBasePrice),
    rentAmount: String(contract?.rentAmount ?? roomBasePrice),
    electricityPriceOverride:
      contract?.electricityPriceOverride === null ||
      contract?.electricityPriceOverride === undefined
        ? ""
        : String(contract.electricityPriceOverride),
    waterPriceOverride:
      contract?.waterPriceOverride === null ||
      contract?.waterPriceOverride === undefined
        ? ""
        : String(contract.waterPriceOverride),
    startDate: contract?.startDate ?? "",
    endDate: contract?.endDate ?? "",
    status: contract?.status ?? "Active",
  };
}

function validateContractDraft(draft: ContractDraft) {
  if (!draft.keyTenantId) {
    return "Chọn Người thuê đại diện trước khi lưu Hợp đồng.";
  }

  if (!draft.startDate) {
    return "Chọn ngày bắt đầu Hợp đồng.";
  }

  if (draft.endDate && draft.endDate < draft.startDate) {
    return "Ngày kết thúc không thể trước ngày bắt đầu.";
  }

  if (!isNonNegativeNumericText(draft.rentAmount)) {
    return "Giá thuê phải là số không âm.";
  }

  if (!isNonNegativeNumericText(draft.depositAmount)) {
    return "Tiền cọc phải là số không âm.";
  }

  if (
    draft.electricityPriceOverride &&
    !isNonNegativeNumericText(draft.electricityPriceOverride)
  ) {
    return "Giá điện riêng phải là số không âm hoặc để trống.";
  }

  if (
    draft.waterPriceOverride &&
    !isNonNegativeNumericText(draft.waterPriceOverride)
  ) {
    return "Giá nước riêng phải là số không âm hoặc để trống.";
  }

  return null;
}

function toMutationPayload(
  draft: ContractDraft,
  includeStatus: boolean,
): ContractMutationPayload {
  return {
    keyTenantId: draft.keyTenantId,
    depositAmount: Number(draft.depositAmount),
    rentAmount: Number(draft.rentAmount),
    electricityPriceOverride: optionalNumber(draft.electricityPriceOverride),
    waterPriceOverride: optionalNumber(draft.waterPriceOverride),
    startDate: draft.startDate,
    endDate: draft.endDate || null,
    ...(includeStatus ? { status: draft.status } : {}),
  };
}

function optionalNumber(value: string) {
  return value.trim() ? Number(value) : null;
}

function isNonNegativeNumericText(value: string) {
  if (!value.trim()) {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function upsertContract(
  current: ContractListItem[],
  savedContract: ContractListItem,
) {
  const exists = current.some((contract) => contract.id === savedContract.id);
  const next = exists
    ? current.map((contract) =>
        contract.id === savedContract.id ? savedContract : contract,
      )
    : [...current, savedContract];

  return next.sort(compareContracts);
}

async function invalidateContractDependents({
  queryClient,
  roomId,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  roomId: string;
}) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: contractQueryKeys.room(roomId) }),
    queryClient.invalidateQueries({ queryKey: roomQueryKeys.list() }),
    queryClient.invalidateQueries({ queryKey: roomQueryKeys.detail(roomId) }),
    queryClient.invalidateQueries({ queryKey: tenantQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
  ]);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("vi-VN").format(new Date(year, month - 1, day));
}

function formatOptionalUnitPrice(value: number | null, unit: string) {
  return value === null ? "Dùng bảng giá chung" : `${formatCurrency(value)} / ${unit}`;
}

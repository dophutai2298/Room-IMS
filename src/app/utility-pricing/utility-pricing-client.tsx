"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppApiClientError, fetchAppApi } from "@/lib/api/client";
import { createDataTableColumnHelper } from "@/lib/data-table/tanstack";
import { dashboardQueryKeys } from "@/lib/dashboard/query-keys";
import { formatCurrency } from "@/lib/formatters";
import { invoiceQueryKeys } from "@/lib/invoices/query-keys";
import { utilityMetricsQueryKeys } from "@/lib/utilities/query-keys";
import type { UtilityPricingListItem } from "@/lib/utility-pricing/presenter";
import { utilityPricingQueryKeys } from "@/lib/utility-pricing/query-keys";

type PricingDraft = {
  effectiveFrom: string;
  electricityUnitPrice: string;
  waterUnitPrice: string;
};

const defaultPricingDraft: PricingDraft = {
  effectiveFrom: "",
  electricityUnitPrice: "",
  waterUnitPrice: "",
};

const pricingColumnHelper =
  createDataTableColumnHelper<UtilityPricingListItem>();

export function UtilityPricingClient() {
  const pricingQuery = useQuery({
    queryKey: utilityPricingQueryKeys.list(),
    queryFn: () =>
      fetchAppApi<UtilityPricingListItem[]>("/api/utility-pricing", {
        cache: "no-store",
      }),
  });
  const columns = useMemo(
    () =>
      pricingColumnHelper.columns([
        pricingColumnHelper.accessor("effectiveFrom", {
          header: "Ngày hiệu lực",
          cell: (info) => (
            <span className="font-medium">
              {info.row.original.effectiveFromLabel}
            </span>
          ),
          sortFn: "datetime",
        }),
        pricingColumnHelper.accessor("electricityUnitPrice", {
          header: "Giá điện",
          cell: (info) => (
            <span className="font-mono tabular-nums">
              {formatCurrency(info.getValue())}
            </span>
          ),
          enableGlobalFilter: false,
        }),
        pricingColumnHelper.accessor("waterUnitPrice", {
          header: "Giá nước",
          cell: (info) => (
            <span className="font-mono tabular-nums">
              {formatCurrency(info.getValue())}
            </span>
          ),
          enableGlobalFilter: false,
        }),
        pricingColumnHelper.accessor(
          (pricing) => (pricing.isActive ? "active" : "history"),
          {
            id: "status",
            header: "Trạng thái",
            cell: (info) => {
              const isActive = info.getValue() === "active";

              return (
                <Badge variant={isActive ? "success" : "secondary"}>
                  {isActive ? "Đang áp dụng" : "Lịch sử"}
                </Badge>
              );
            },
            enableGlobalFilter: false,
            filterFn: "equalsString",
            sortFn: "alphanumeric",
          },
        ),
        pricingColumnHelper.display({
          id: "actions",
          header: "Thao tác",
          cell: ({ row }) =>
            row.original.isActive ? (
              <div className="flex justify-end">
                <DeactivatePricingButton pricing={row.original} />
              </div>
            ) : (
              <span className="block text-right text-xs text-muted-foreground">
                Đã lưu lịch sử
              </span>
            ),
          enableHiding: false,
          enableSorting: false,
        }),
      ]),
    [],
  );

  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Cấu hình vận hành</p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Bảng giá điện nước
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Quản lý giá điện/nước theo thời gian. Hóa đơn vẫn ưu tiên giá
            cụ thể trong Hợp đồng; nếu không có giá cụ thể riêng cho từng phòng thì dùng bảng giá chung
            phù hợp này với kỳ thu.
          </p>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <CreatePricingCard />

        <DataTable
          columns={columns}
          data={pricingQuery.data ?? []}
          description="Không xóa giá cũ để hóa đơn tháng trước vẫn giải quyết đúng giá áp dụng."
          emptyMessage="Thêm bảng giá đầu tiên để hóa đơn có thể tính điện/nước khi Hợp đồng không có."
          emptyTitle="Chưa có bảng giá"
          errorMessage={
            pricingQuery.isError ? pricingQuery.error.message : undefined
          }
          filteredEmptyMessage="Thử đổi từ khóa search hoặc trạng thái bảng giá."
          filteredEmptyTitle="Không tìm thấy bảng giá"
          isFetching={pricingQuery.isFetching}
          isLoading={pricingQuery.isPending}
          onRetry={() => void pricingQuery.refetch()}
          searchPlaceholder="Tìm ngày hiệu lực..."
          statusFilter={{
            columnId: "status",
            label: "Lọc trạng thái",
            allLabel: "Tất cả trạng thái",
            options: [
              { value: "active", label: "Đang áp dụng" },
              { value: "history", label: "Lịch sử" },
            ],
          }}
          title="Lịch sử bảng giá"
        />
      </section>
    </>
  );
}

function CreatePricingCard() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PricingDraft>(defaultPricingDraft);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const validationMessage = useMemo(() => validatePricingDraft(draft), [draft]);

  const mutation = useMutation<
    UtilityPricingListItem,
    AppApiClientError,
    {
      effectiveFrom: string;
      electricityUnitPrice: number;
      waterUnitPrice: number;
    }
  >({
    mutationFn: (payload) =>
      fetchAppApi<UtilityPricingListItem>("/api/utility-pricing", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (pricing) => {
      queryClient.setQueryData<UtilityPricingListItem[]>(
        utilityPricingQueryKeys.list(),
        (current) => {
          const next = [
            pricing,
            ...(current ?? []).map((item) => ({
              ...item,
              isActive: item.id === pricing.id ? item.isActive : false,
              statusLabel:
                item.id === pricing.id ? item.statusLabel : "Lịch sử",
            })),
          ];
          const byId = new Map(next.map((item) => [item.id, item]));

          return [...byId.values()].sort(
            (left, right) =>
              new Date(right.effectiveFrom).getTime() -
              new Date(left.effectiveFrom).getTime(),
          );
        },
      );

      await invalidatePricingDependents(queryClient);
      toast.success("Đã tạo bảng giá mới và lưu lịch sử bảng giá cũ.");
      setDraft(defaultPricingDraft);
      setServerMessage(null);
    },
    onError: (error) => {
      setServerMessage(error.message);
    },
  });

  function handleSubmit() {
    if (validationMessage || mutation.isPending) {
      setServerMessage(validationMessage);
      return;
    }

    setServerMessage(null);
    mutation.mutate({
      effectiveFrom: draft.effectiveFrom,
      electricityUnitPrice: Number.parseFloat(draft.electricityUnitPrice),
      waterUnitPrice: Number.parseFloat(draft.waterUnitPrice),
    });
  }

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Thêm bảng giá mới</CardTitle>
        <CardDescription>
          Dòng mới sẽ được đánh dấu đang áp dụng; các dòng đang hoạt động cũ chuyển về
          lịch sử để không mất dữ liệu kỳ trước.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="pricing-effective-from">Ngày hiệu lực</Label>
          <Input
            id="pricing-effective-from"
            type="date"
            value={draft.effectiveFrom}
            disabled={mutation.isPending}
            onChange={(event) => {
              setDraft((current) => ({
                ...current,
                effectiveFrom: event.target.value,
              }));
              setServerMessage(null);
            }}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="pricing-electricity">Giá điện / kWh</Label>
          <Input
            id="pricing-electricity"
            type="number"
            min={0}
            step={100}
            placeholder="3900"
            value={draft.electricityUnitPrice}
            disabled={mutation.isPending}
            onChange={(event) => {
              setDraft((current) => ({
                ...current,
                electricityUnitPrice: event.target.value,
              }));
              setServerMessage(null);
            }}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="pricing-water">Giá nước / m³</Label>
          <Input
            id="pricing-water"
            type="number"
            min={0}
            step={500}
            placeholder="18000"
            value={draft.waterUnitPrice}
            disabled={mutation.isPending}
            onChange={(event) => {
              setDraft((current) => ({
                ...current,
                waterUnitPrice: event.target.value,
              }));
              setServerMessage(null);
            }}
          />
        </div>

        {(validationMessage || serverMessage) && (
          <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {serverMessage ?? validationMessage}
          </p>
        )}

        <Button
          type="button"
          className="w-full"
          onClick={handleSubmit}
          disabled={mutation.isPending || Boolean(validationMessage)}
        >
          {mutation.isPending ? "Đang lưu..." : "Tạo bảng giá"}
        </Button>
      </CardContent>
    </Card>
  );
}

function DeactivatePricingButton({
  pricing,
}: {
  pricing: UtilityPricingListItem;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation<UtilityPricingListItem, AppApiClientError>({
    mutationFn: () =>
      fetchAppApi<UtilityPricingListItem>(
        `/api/utility-pricing/${pricing.id}`,
        {
          method: "PATCH",
        },
      ),
    onSuccess: async (savedPricing) => {
      queryClient.setQueryData<UtilityPricingListItem[]>(
        utilityPricingQueryKeys.list(),
        (current) =>
          (current ?? []).map((item) =>
            item.id === savedPricing.id ? savedPricing : item,
          ),
      );
      await invalidatePricingDependents(queryClient);
      toast.success("Đã chuyển bảng giá về lịch sử.");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? "Đang lưu..." : "Ngưng áp dụng"}
    </Button>
  );
}

function validatePricingDraft(draft: PricingDraft) {
  if (!draft.effectiveFrom) {
    return "Chọn ngày hiệu lực.";
  }

  const electricityUnitPrice = Number.parseFloat(draft.electricityUnitPrice);

  if (!Number.isFinite(electricityUnitPrice) || electricityUnitPrice < 0) {
    return "Giá điện phải là số không âm.";
  }

  const waterUnitPrice = Number.parseFloat(draft.waterUnitPrice);

  if (!Number.isFinite(waterUnitPrice) || waterUnitPrice < 0) {
    return "Giá nước phải là số không âm.";
  }

  return null;
}

async function invalidatePricingDependents(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: utilityPricingQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: utilityMetricsQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
  ]);
}

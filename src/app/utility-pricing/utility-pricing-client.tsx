"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppApiClientError, fetchAppApi } from "@/lib/api/client";
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

export function UtilityPricingClient() {
  const pricingQuery = useQuery({
    queryKey: utilityPricingQueryKeys.list(),
    queryFn: () =>
      fetchAppApi<UtilityPricingListItem[]>("/api/utility-pricing", {
        cache: "no-store",
      }),
  });

  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Cấu hình vận hành</p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Bảng giá điện nước
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Quản lý timeline giá điện/nước toàn nhà. Hóa đơn vẫn ưu tiên giá
            override trong Contract; nếu không có override thì dùng bảng giá
            phù hợp với kỳ thu.
          </p>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <CreatePricingCard />

        {pricingQuery.isPending ? (
          <PricingSkeleton />
        ) : pricingQuery.isError ? (
          <PricingErrorCard
            message={pricingQuery.error.message}
            onRetry={() => void pricingQuery.refetch()}
          />
        ) : pricingQuery.data.length === 0 ? (
          <PricingEmptyCard onRetry={() => void pricingQuery.refetch()} />
        ) : (
          <PricingTable pricingRows={pricingQuery.data} />
        )}
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
          Dòng mới sẽ được đánh dấu đang áp dụng; các dòng active cũ chuyển về
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

function PricingTable({
  pricingRows,
}: {
  pricingRows: UtilityPricingListItem[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lịch sử bảng giá</CardTitle>
        <CardDescription>
          Không xóa giá cũ để hóa đơn tháng trước vẫn resolve đúng giá áp dụng.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ngày hiệu lực</TableHead>
              <TableHead>Giá điện</TableHead>
              <TableHead>Giá nước</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pricingRows.map((pricing) => (
              <TableRow key={pricing.id}>
                <TableCell className="font-medium">
                  {pricing.effectiveFromLabel}
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {formatCurrency(pricing.electricityUnitPrice)}
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {formatCurrency(pricing.waterUnitPrice)}
                </TableCell>
                <TableCell>
                  <Badge variant={pricing.isActive ? "success" : "secondary"}>
                    {pricing.statusLabel}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {pricing.isActive ? (
                    <DeactivatePricingButton pricing={pricing} />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Đã lưu lịch sử
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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

function PricingSkeleton() {
  return (
    <Card aria-busy="true" aria-live="polite">
      <CardContent className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 md:grid-cols-4"
          >
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PricingEmptyCard({ onRetry }: { onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="rounded-[1.5rem] border border-dashed border-border bg-muted/25 p-8 text-center">
        <p className="text-lg font-semibold">Chưa có bảng giá</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Thêm bảng giá đầu tiên để hóa đơn có thể tính điện/nước khi Contract
          không có override.
        </p>
        <Button className="mt-5" variant="secondary" onClick={onRetry}>
          Tải lại
        </Button>
      </CardContent>
    </Card>
  );
}

function PricingErrorCard({
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
        <h2 className="text-lg font-semibold">Không tải được bảng giá</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="secondary" onClick={onRetry}>
          Thử lại
        </Button>
      </CardContent>
    </Card>
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

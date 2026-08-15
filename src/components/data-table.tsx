"use client";

import { useState, type ReactNode } from "react";
import {
  useTable,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DATA_TABLE_PAGE_SIZE_OPTIONS,
  buildDataTableStateView,
  formatDataTablePageSummary,
  normalizeDataTablePageSize,
} from "@/lib/data-table/state";
import {
  managementDataTableFeatures,
  type DataTableColumnDef,
  type ManagementDataTableFeatures,
} from "@/lib/data-table/tanstack";
import { cn } from "@/lib/utils";

const ALL_FILTER_VALUE = "__all__";

type DataTableInstance<TData extends RowData> = ReturnType<
  typeof useTable<ManagementDataTableFeatures, TData>
>;
type DataTableLeafColumns<TData extends RowData> = ReturnType<
  DataTableInstance<TData>["getAllLeafColumns"]
>;
type DataTableHeaderGroup<TData extends RowData> = ReturnType<
  DataTableInstance<TData>["getHeaderGroups"]
>[number];
type DataTableColumnHeader<TData extends RowData> =
  DataTableHeaderGroup<TData>["headers"][number];

export type DataTableFilterOption = {
  value: string;
  label: string;
};

export type DataTableStatusFilter = {
  columnId: string;
  label: string;
  allLabel?: string;
  options: DataTableFilterOption[];
};

export type DataTableProps<TData extends RowData> = {
  columns: DataTableColumnDef<TData>[];
  data: TData[];
  title?: string;
  description?: string;
  toolbarStart?: ReactNode;
  toolbarEnd?: ReactNode;
  searchPlaceholder?: string;
  statusFilter?: DataTableStatusFilter;
  isLoading?: boolean;
  isFetching?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyMessage?: string;
  filteredEmptyTitle?: string;
  filteredEmptyMessage?: string;
  loadingRowCount?: number;
  defaultPageSize?: number;
  manualPagination?: boolean;
  pageCount?: number;
  rowCount?: number;
  getRowId?: (row: TData, index: number) => string;
  variant?: "card" | "plain";
};

export function DataTable<TData extends RowData>({
  columns,
  data,
  title,
  description,
  toolbarStart,
  toolbarEnd,
  searchPlaceholder = "Tìm kiếm...",
  statusFilter,
  isLoading = false,
  isFetching = false,
  errorMessage,
  onRetry,
  emptyTitle = "Chưa có dữ liệu",
  emptyMessage = "Chưa có dòng nào để hiển thị.",
  filteredEmptyTitle = "Không tìm thấy dữ liệu",
  filteredEmptyMessage = "Thử đổi từ khóa search hoặc bộ lọc.",
  loadingRowCount = 6,
  defaultPageSize = 10,
  manualPagination = false,
  pageCount,
  rowCount,
  getRowId,
  variant = "card",
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({});
  const [pagination, setPagination] = useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize: normalizeDataTablePageSize(defaultPageSize),
  }));

  function resetPageIndex() {
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 },
    );
  }

  function handleGlobalFilterChange(value: string) {
    setGlobalFilter(value);
    resetPageIndex();
  }

  const table = useTable(
    {
      features: managementDataTableFeatures,
      columns,
      data,
      getRowId,
      globalFilterFn: "includesString",
      manualPagination,
      autoResetPageIndex: !manualPagination,
      pageCount,
      rowCount,
      state: {
        columnFilters,
        columnVisibility,
        globalFilter,
        pagination,
        sorting,
      },
      onColumnFiltersChange: setColumnFilters,
      onColumnVisibilityChange: setColumnVisibility,
      onGlobalFilterChange: setGlobalFilter,
      onPaginationChange: setPagination,
      onSortingChange: setSorting,
    },
    (state) => state,
  );

  const preFilteredRows = table.getPreFilteredRowModel().rows.length;
  const filteredRows = table.getPrePaginatedRowModel().rows.length;
  const visibleColumnCount = Math.max(table.getVisibleLeafColumns().length, 1);
  const hasActiveFilters =
    Boolean(globalFilter.trim()) || columnFilters.length > 0;
  const stateView = buildDataTableStateView({
    isLoading,
    isFetching,
    errorMessage,
    rowCount: preFilteredRows,
    filteredRowCount: filteredRows,
    hasActiveFilters,
    hasRetryAction: Boolean(onRetry),
  });
  const pageSummary = formatDataTablePageSummary({
    pageIndex: pagination.pageIndex,
    pageSize: pagination.pageSize,
    filteredRowCount: filteredRows,
  });
  const hideableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide());

  const content = (
    <div className={cn(variant === "plain" && "space-y-4")}>
      <DataTableHeader
        description={description}
        globalFilter={globalFilter}
        hideableColumns={hideableColumns}
        isFetching={stateView.kind === "fetching"}
        onUserFilterChange={resetPageIndex}
        searchPlaceholder={searchPlaceholder}
        setGlobalFilter={handleGlobalFilterChange}
        statusFilter={statusFilter}
        table={table}
        title={title}
        toolbarEnd={toolbarEnd}
        toolbarStart={toolbarStart}
      />

      <div className={cn(variant === "card" ? "px-6 pb-6" : undefined)}>
        <div className="overflow-hidden rounded-xl border border-white/45 bg-background/30 clay-inset dark:border-white/8">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : (
                        <DataTableHeaderCell header={header} table={table} />
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {stateView.kind === "loading" ? (
                <DataTableSkeletonRows
                  columnCount={visibleColumnCount}
                  rowCount={loadingRowCount}
                />
              ) : stateView.kind === "error" ? (
                <DataTableMessageRow
                  action={stateView.canRetry ? <Button variant="secondary" onClick={onRetry}>Thử lại</Button> : null}
                  columnCount={visibleColumnCount}
                  message={errorMessage ?? "Không thể tải dữ liệu bảng."}
                  title="Không thể tải dữ liệu"
                />
              ) : stateView.kind === "empty" ? (
                <DataTableMessageRow
                  action={stateView.canRetry ? <Button variant="secondary" onClick={onRetry}>Tải lại</Button> : null}
                  columnCount={visibleColumnCount}
                  message={emptyMessage}
                  title={emptyTitle}
                />
              ) : stateView.kind === "filtered-empty" ? (
                <DataTableMessageRow
                  columnCount={visibleColumnCount}
                  message={filteredEmptyMessage}
                  title={filteredEmptyTitle}
                />
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
          <div aria-live="polite">
            {pageSummary.filteredRowCount === 0
              ? "0 dòng"
              : `${pageSummary.from}-${pageSummary.to} / ${pageSummary.filteredRowCount} dòng`}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2">
              <span>Số dòng</span>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger className="h-9 w-20" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_TABLE_PAGE_SIZE_OPTIONS.map((pageSizeOption) => (
                    <SelectItem
                      key={pageSizeOption}
                      value={String(pageSizeOption)}
                    >
                      {pageSizeOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span>
                Trang {pageSummary.currentPage} / {pageSummary.pageCount}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Trước
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Sau
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (variant === "plain") {
    return content;
  }

  return <Card className="overflow-hidden">{content}</Card>;
}

function DataTableHeader<TData extends RowData>({
  description,
  globalFilter,
  hideableColumns,
  isFetching,
  onUserFilterChange,
  searchPlaceholder,
  setGlobalFilter,
  statusFilter,
  table,
  title,
  toolbarEnd,
  toolbarStart,
}: {
  description?: string;
  globalFilter: string;
  hideableColumns: DataTableLeafColumns<TData>;
  isFetching: boolean;
  onUserFilterChange: () => void;
  searchPlaceholder: string;
  setGlobalFilter: (value: string) => void;
  statusFilter?: DataTableStatusFilter;
  table: ReturnType<typeof useTable<typeof managementDataTableFeatures, TData>>;
  title?: string;
  toolbarEnd?: ReactNode;
  toolbarStart?: ReactNode;
}) {
  const activeStatusValue = statusFilter
    ? String(table.getColumn(statusFilter.columnId)?.getFilterValue() ?? ALL_FILTER_VALUE)
    : ALL_FILTER_VALUE;

  return (
    <CardHeader className="gap-4">
      {(title || description) && (
        <div>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </div>
      )}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          {toolbarStart}
          <Input
            value={globalFilter}
            placeholder={searchPlaceholder}
            onChange={(event) => setGlobalFilter(event.currentTarget.value)}
            className="w-full sm:max-w-xs"
          />
          {statusFilter && (
            <Select
              value={activeStatusValue}
              onValueChange={(value) => {
                table
                  .getColumn(statusFilter.columnId)
                  ?.setFilterValue(value === ALL_FILTER_VALUE ? undefined : value);
                onUserFilterChange();
              }}
            >
              <SelectTrigger className="w-full sm:w-48" aria-label={statusFilter.label}>
                <SelectValue placeholder={statusFilter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>
                  {statusFilter.allLabel ?? "Tất cả"}
                </SelectItem>
                {statusFilter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isFetching && <Badge variant="secondary">Đang cập nhật</Badge>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {toolbarEnd}
          {hideableColumns.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  Cột
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Cột hiển thị</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideableColumns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                  >
                    {getColumnVisibilityLabel(column)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </CardHeader>
  );
}

function DataTableHeaderCell<TData extends RowData>({
  header,
  table,
}: {
  header: DataTableColumnHeader<TData>;
  table: DataTableInstance<TData>;
}) {
  const sorting = header.column.getIsSorted();
  const canSort = header.column.getCanSort();

  if (!canSort) {
    return <table.FlexRender header={header} />;
  }

  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 text-left hover:text-foreground"
      onClick={header.column.getToggleSortingHandler()}
      title={
        header.column.getNextSortingOrder() === "asc"
          ? "Sắp xếp tăng dần"
          : header.column.getNextSortingOrder() === "desc"
            ? "Sắp xếp giảm dần"
            : "Bỏ sắp xếp"
      }
    >
      <span>
        <table.FlexRender header={header} />
      </span>
      <span className="text-xs text-muted-foreground" aria-hidden="true">
        {sorting === "asc" ? "↑" : sorting === "desc" ? "↓" : "↕"}
      </span>
    </button>
  );
}

function DataTableSkeletonRows({
  columnCount,
  rowCount,
}: {
  columnCount: number;
  rowCount: number;
}) {
  return Array.from({ length: rowCount }).map((_, rowIndex) => (
    <TableRow key={rowIndex}>
      {Array.from({ length: columnCount }).map((__, columnIndex) => (
        <TableCell key={columnIndex}>
          <Skeleton className="h-5 w-full" />
        </TableCell>
      ))}
    </TableRow>
  ));
}

function DataTableMessageRow({
  action,
  columnCount,
  message,
  title,
}: {
  action?: ReactNode;
  columnCount: number;
  message: string;
  title: string;
}) {
  return (
    <TableRow>
      <TableCell colSpan={columnCount} className="py-10 text-center">
        <div className="mx-auto max-w-md space-y-3">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{message}</p>
          {action}
        </div>
      </TableCell>
    </TableRow>
  );
}

function getColumnLabel(columnId: string) {
  return columnId
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getColumnVisibilityLabel<TData extends RowData>(
  column: DataTableLeafColumns<TData>[number],
) {
  return typeof column.columnDef.header === "string"
    ? column.columnDef.header
    : getColumnLabel(column.id);
}

export const DATA_TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export type DataTableStateKind =
  | "loading"
  | "error"
  | "empty"
  | "filtered-empty"
  | "fetching"
  | "ready";

export type DataTableStateView = {
  canRetry: boolean;
  kind: DataTableStateKind;
  keepsRowsVisible: boolean;
};

export type DataTablePageSummary = {
  currentPage: number;
  pageCount: number;
  from: number;
  to: number;
  filteredRowCount: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
};

export function buildDataTableStateView({
  isLoading = false,
  isFetching = false,
  errorMessage,
  rowCount,
  filteredRowCount,
  hasActiveFilters,
  hasRetryAction = false,
}: {
  isLoading?: boolean;
  isFetching?: boolean;
  errorMessage?: string;
  rowCount: number;
  filteredRowCount: number;
  hasActiveFilters: boolean;
  hasRetryAction?: boolean;
}): DataTableStateView {
  if (isLoading) {
    return { canRetry: false, keepsRowsVisible: false, kind: "loading" };
  }

  if (errorMessage) {
    return {
      canRetry: hasRetryAction,
      keepsRowsVisible: false,
      kind: "error",
    };
  }

  if (rowCount === 0) {
    return { canRetry: hasRetryAction, keepsRowsVisible: false, kind: "empty" };
  }

  if (filteredRowCount === 0 && hasActiveFilters) {
    return {
      canRetry: false,
      keepsRowsVisible: false,
      kind: "filtered-empty",
    };
  }

  if (isFetching) {
    return { canRetry: false, keepsRowsVisible: true, kind: "fetching" };
  }

  return { canRetry: false, keepsRowsVisible: true, kind: "ready" };
}

export function formatDataTablePageSummary({
  pageIndex,
  pageSize,
  filteredRowCount,
}: {
  pageIndex: number;
  pageSize: number;
  filteredRowCount: number;
}): DataTablePageSummary {
  const pageCount = Math.max(1, Math.ceil(filteredRowCount / pageSize));
  const currentPage = Math.min(Math.max(0, pageIndex), pageCount - 1) + 1;

  if (filteredRowCount === 0) {
    return {
      currentPage: 1,
      pageCount,
      from: 0,
      to: 0,
      filteredRowCount,
      canPreviousPage: false,
      canNextPage: false,
    };
  }

  return {
    currentPage,
    pageCount,
    from: (currentPage - 1) * pageSize + 1,
    to: Math.min(currentPage * pageSize, filteredRowCount),
    filteredRowCount,
    canPreviousPage: currentPage > 1,
    canNextPage: currentPage < pageCount,
  };
}

export function normalizeDataTablePageSize(value: number) {
  return DATA_TABLE_PAGE_SIZE_OPTIONS.includes(
    value as (typeof DATA_TABLE_PAGE_SIZE_OPTIONS)[number],
  )
    ? value
    : DATA_TABLE_PAGE_SIZE_OPTIONS[0];
}

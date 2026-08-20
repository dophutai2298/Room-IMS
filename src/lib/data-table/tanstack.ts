import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type CellData,
  type ColumnDef,
  type FilterFn,
  type RowData,
  type TableFeatures,
} from "@tanstack/table-core";

type PrePaginatedRowModelReader<TData extends RowData> = {
  getPrePaginatedRowModel: () => {
    rows: Array<{ original: TData }>;
  };
};

const filterFn_equalsString: FilterFn<TableFeatures, RowData> = (
  row,
  columnId,
  filterValue,
) => {
  if (filterValue === undefined || filterValue === null || filterValue === "") {
    return true;
  }

  return String(row.getValue(columnId)) === String(filterValue);
};

filterFn_equalsString.autoRemove = (value) =>
  value === undefined || value === null || String(value).trim() === "";

export const managementDataTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: {
    equalsString: filterFn_equalsString,
    includesString: filterFn_includesString,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

export type ManagementDataTableFeatures = typeof managementDataTableFeatures;

export type DataTableColumnDef<TData extends RowData> = ColumnDef<
  ManagementDataTableFeatures,
  TData,
  CellData
>;

export function createDataTableColumnHelper<TData extends RowData>() {
  return createColumnHelper<ManagementDataTableFeatures, TData>();
}

export function getDataTableCurrentViewRows<TData extends RowData>(
  table: PrePaginatedRowModelReader<TData>,
) {
  return table.getPrePaginatedRowModel().rows.map((row) => row.original);
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  constructTable,
  createColumnHelper,
  functionalUpdate,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type SortingState,
  type Table,
  type Updater,
} from "@tanstack/table-core";
import { table_setOptions } from "@tanstack/table-core/static-functions";
import { storeReactivityBindings } from "@tanstack/table-core/store-reactivity-bindings";

import { managementDataTableFeatures } from "./tanstack";

type FixtureRow = {
  id: string;
  name: string;
  rent: number;
  status: "Active" | "Moved";
};

type FixtureTableState = {
  columnFilters: ColumnFiltersState;
  columnVisibility: ColumnVisibilityState;
  globalFilter: string;
  pagination: PaginationState;
  sorting: SortingState;
};

type FixtureFeatures = ReturnType<typeof createFixtureFeatures>;

const columnHelper = createColumnHelper<FixtureFeatures, FixtureRow>();
const columns = columnHelper.columns([
  columnHelper.accessor("name", {
    header: "Name",
    sortFn: "alphanumeric",
  }),
  columnHelper.accessor("status", {
    header: "Status",
    enableGlobalFilter: false,
    filterFn: "equalsString",
    sortFn: "alphanumeric",
  }),
  columnHelper.accessor("rent", {
    header: "Rent",
    enableGlobalFilter: false,
  }),
]);

const fixtureRows: FixtureRow[] = [
  { id: "1", name: "Binh", rent: 2_000_000, status: "Active" },
  { id: "2", name: "An", rent: 1_000_000, status: "Moved" },
  { id: "3", name: "Cuong", rent: 3_000_000, status: "Active" },
];

describe("management DataTable TanStack feature model", () => {
  it("supports search, status filtering, sorting, visibility, and pagination", () => {
    const harness = createFixtureTableHarness();

    harness.table.setGlobalFilter("an");
    assert.deepEqual(harness.visibleNames(), ["An"]);

    harness.table.setGlobalFilter("");
    harness.table.getColumn("status")?.setFilterValue("Active");
    assert.deepEqual(harness.visibleNames(), ["Binh", "Cuong"]);

    harness.table.setColumnFilters([]);
    harness.table.setSorting([{ desc: false, id: "name" }]);
    assert.deepEqual(harness.visibleNames(), ["An", "Binh", "Cuong"]);

    harness.table.setPageSize(1);
    assert.deepEqual(harness.visibleNames(), ["An"]);
    assert.equal(harness.table.getCanNextPage(), true);

    harness.table.nextPage();
    assert.deepEqual(harness.state.pagination, { pageIndex: 1, pageSize: 1 });
    assert.deepEqual(harness.visibleNames(), ["Binh"]);

    harness.table.getColumn("rent")?.toggleVisibility(false);
    assert.deepEqual(harness.visibleColumnIds(), ["name", "status"]);
  });

  it("auto-resets out-of-range pages when refreshed client data shrinks", async () => {
    const harness = createFixtureTableHarness();

    harness.table.setSorting([{ desc: false, id: "name" }]);
    harness.table.setPagination({ pageIndex: 2, pageSize: 1 });
    assert.deepEqual(harness.visibleNames(), ["Cuong"]);

    harness.replaceData([fixtureRows[1]]);
    assert.deepEqual(harness.visibleNames(), []);

    await Promise.resolve();
    assert.deepEqual(harness.state.pagination, { pageIndex: 0, pageSize: 1 });
    assert.deepEqual(harness.visibleNames(), ["An"]);
  });
});

function createFixtureTableHarness() {
  let data = fixtureRows;
  let state: FixtureTableState = {
    columnFilters: [],
    columnVisibility: {},
    globalFilter: "",
    pagination: { pageIndex: 0, pageSize: 10 },
    sorting: [],
  };
  let table = undefined as unknown as Table<FixtureFeatures, FixtureRow>;

  function setStateSlice<K extends keyof FixtureTableState>(
    key: K,
    updater: Updater<FixtureTableState[K]>,
  ) {
    state = {
      ...state,
      [key]: functionalUpdate(updater, state[key]),
    };
    syncOptions();
  }

  function syncOptions() {
    table_setOptions(
      table,
      (previous) => ({
        ...previous,
        data,
        state,
      }),
      { syncExternalState: false },
    );
  }

  table = constructTable({
    autoResetPageIndex: true,
    columns,
    data,
    features: createFixtureFeatures(),
    getRowId: (row) => row.id,
    globalFilterFn: "includesString",
    onColumnFiltersChange: (updater) =>
      setStateSlice("columnFilters", updater),
    onColumnVisibilityChange: (updater) =>
      setStateSlice("columnVisibility", updater),
    onGlobalFilterChange: (updater) => setStateSlice("globalFilter", updater),
    onPaginationChange: (updater) => setStateSlice("pagination", updater),
    onSortingChange: (updater) => setStateSlice("sorting", updater),
    state,
  });

  return {
    get state() {
      return state;
    },
    replaceData(nextData: FixtureRow[]) {
      data = nextData;
      syncOptions();
    },
    table,
    visibleColumnIds() {
      return table.getVisibleLeafColumns().map((column) => column.id);
    },
    visibleNames() {
      return table.getRowModel().rows.map((row) => row.original.name);
    },
  };
}

function createFixtureFeatures() {
  return {
    coreReactivityFeature: storeReactivityBindings(),
    ...managementDataTableFeatures,
  };
}

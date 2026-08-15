import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildDataTableStateView,
  formatDataTablePageSummary,
  normalizeDataTablePageSize,
} from "./state";

describe("management DataTable state model", () => {
  it("distinguishes loading, error, empty, filtered empty, fetching, and ready states", () => {
    assert.deepEqual(
      buildDataTableStateView({
        isLoading: true,
        isFetching: true,
        rowCount: 0,
        filteredRowCount: 0,
        hasActiveFilters: false,
      }),
      {
        canRetry: false,
        keepsRowsVisible: false,
        kind: "loading",
      },
    );

    assert.deepEqual(
      buildDataTableStateView({
        errorMessage: "Could not load",
        hasRetryAction: true,
        rowCount: 3,
        filteredRowCount: 3,
        hasActiveFilters: false,
      }),
      {
        canRetry: true,
        keepsRowsVisible: false,
        kind: "error",
      },
    );

    assert.deepEqual(
      buildDataTableStateView({
        hasRetryAction: true,
        rowCount: 0,
        filteredRowCount: 0,
        hasActiveFilters: false,
      }),
      {
        canRetry: true,
        keepsRowsVisible: false,
        kind: "empty",
      },
    );

    assert.deepEqual(
      buildDataTableStateView({
        rowCount: 3,
        filteredRowCount: 0,
        hasActiveFilters: true,
      }),
      {
        canRetry: false,
        keepsRowsVisible: false,
        kind: "filtered-empty",
      },
    );

    assert.deepEqual(
      buildDataTableStateView({
        isFetching: true,
        rowCount: 3,
        filteredRowCount: 3,
        hasActiveFilters: false,
      }),
      {
        canRetry: false,
        keepsRowsVisible: true,
        kind: "fetching",
      },
    );

    assert.deepEqual(
      buildDataTableStateView({
        rowCount: 3,
        filteredRowCount: 3,
        hasActiveFilters: false,
      }),
      {
        canRetry: false,
        keepsRowsVisible: true,
        kind: "ready",
      },
    );
  });

  it("formats pagination summary and clamps supported page sizes", () => {
    assert.deepEqual(
      formatDataTablePageSummary({
        pageIndex: 1,
        pageSize: 10,
        filteredRowCount: 27,
      }),
      {
        currentPage: 2,
        pageCount: 3,
        from: 11,
        to: 20,
        filteredRowCount: 27,
        canPreviousPage: true,
        canNextPage: true,
      },
    );

    assert.deepEqual(
      formatDataTablePageSummary({
        pageIndex: 5,
        pageSize: 20,
        filteredRowCount: 0,
      }),
      {
        currentPage: 1,
        pageCount: 1,
        from: 0,
        to: 0,
        filteredRowCount: 0,
        canPreviousPage: false,
        canNextPage: false,
      },
    );

    assert.equal(normalizeDataTablePageSize(20), 20);
    assert.equal(normalizeDataTablePageSize(30), 10);
  });
});

import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JSDOM } from "jsdom";

import type { UtilityMetricsView } from "@/lib/utilities/presenter";

let dom: JSDOM;
let root: Root;
let container: HTMLDivElement;
let queryClient: QueryClient;
let createRoot: typeof import("react-dom/client").createRoot;
let InvoiceGenerationForm: typeof import("@/app/rooms/[id]/utilities/invoice-generation-form").InvoiceGenerationForm;
const originalFetch = globalThis.fetch;
const originalGlobals = new Map<string, PropertyDescriptor | undefined>();
const requests: Array<{ method: string; payload: Record<string, unknown> }> = [];

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const [name, value] of Object.entries(globals)) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
  ({ createRoot } = await import("react-dom/client"));
  ({ InvoiceGenerationForm } = await import("@/app/rooms/[id]/utilities/invoice-generation-form"));
});

beforeEach(() => {
  requests.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  globalThis.fetch = async (_input, init) => {
    const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push({ method: init?.method ?? "GET", payload });
    return Response.json({
      ok: true,
      data: {
        id: "invoice-current",
        other_fee: Number(payload.otherFee),
        other_fee_note: payload.otherFeeNote,
        discount_amount: 0,
        discount_note: null,
      },
    });
  };
});

afterEach(async () => {
  await act(async () => root.unmount());
  queryClient.clear();
  container.remove();
  globalThis.fetch = originalFetch;
});

after(() => {
  dom.window.close();
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

test("untouched carry-forward inputs follow refreshed debt and a newly discovered saved zero invoice", async () => {
  await renderForm(createView());
  assert.equal(amountInput().value, "62500");

  await renderForm(createView({ invoiceOtherFeeDefaults: { amount: 0, note: null } }));
  assert.equal(amountInput().value, "0");
  assert.equal(noteInput().value, "");

  await renderForm(createView());
  await renderForm(createView({
    invoice: {
      id: "invoice-current", status: "Unpaid", totalAmount: 3_000_000,
      amountPaid: 0, otherFee: 0, otherFeeNote: null,
      discountAmount: 0, discountNote: null,
    },
    invoiceOtherFeeDefaults: { amount: 0, note: null },
  }));
  assert.equal(amountInput().value, "0");
  assert.equal(noteInput().value, "");
  assert.equal(requests.length, 0);
});

test("editing the real form preserves the draft across refetch and sends only on invoice submit", async () => {
  await renderForm(createView());
  assert.equal(amountInput().checkValidity(), true);
  assert.equal(requests.length, 0);

  await act(async () => {
    setInputValue(amountInput(), "87500");
    setInputValue(noteInput(), "Tiền nợ đã thỏa thuận lại");
  });
  assert.equal(amountInput().value, "87500");
  assert.equal(noteInput().value, "Tiền nợ đã thỏa thuận lại");
  assert.equal(requests.length, 0);

  await renderForm(createView({ invoiceOtherFeeDefaults: { amount: 0, note: null } }));
  assert.equal(amountInput().value, "87500");
  assert.equal(noteInput().value, "Tiền nợ đã thỏa thuận lại");
  assert.equal(requests.length, 0);

  const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]');
  assert.ok(submit);
  await act(async () => {
    submit.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.deepEqual(requests, [{
    method: "POST",
    payload: {
      month: 11, year: 2026,
      otherFee: "87500", otherFeeNote: "Tiền nợ đã thỏa thuận lại",
      discountAmount: "0", discountNote: "",
    },
  }]);
});

async function renderForm(view: UtilityMetricsView) {
  await act(async () => root.render(createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(InvoiceGenerationForm, { view }),
  )));
}

function amountInput() {
  const input = container.querySelector<HTMLInputElement>("#invoice-other-fee");
  assert.ok(input);
  return input;
}

function noteInput() {
  const input = container.querySelector<HTMLTextAreaElement>("#invoice-other-fee-note");
  assert.ok(input);
  return input;
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input.tagName === "INPUT"
    ? dom.window.HTMLInputElement.prototype
    : dom.window.HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function createView(overrides: Partial<UtilityMetricsView> = {}): UtilityMetricsView {
  return {
    room: { id: "room-1", name: "A101" },
    billingPeriod: { month: 11, year: 2026 },
    periodLabel: "11/2026",
    persistedMetricId: "metric-current",
    keyTenantName: "Nguyễn Văn A",
    activeContractId: "contract-active",
    previousPeriodLabel: "10/2026",
    invoice: null,
    invoiceOtherFeeDefaults: { amount: 62_500, note: "Tiền nợ tháng trước" },
    electricity: { oldReading: 100, newReading: 200, consumption: 100, unit: "kWh" },
    water: { oldReading: 10, newReading: 20, consumption: 10, unit: "m³" },
    ...overrides,
  };
}

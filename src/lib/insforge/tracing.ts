import type {
  ApiTimer,
  ApiTimingAttribute,
  ApiTimingAttributes,
} from "@/lib/api/timing";

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

export function createTracedInsForgeFetch({
  timer,
  fetchImpl = fetch,
}: {
  timer?: ApiTimer;
  fetchImpl?: typeof fetch;
} = {}): typeof fetch {
  if (!timer) {
    return fetchImpl;
  }

  const attemptsByRequest = new Map<string, number>();

  return (async (input: FetchInput, init?: FetchInit) => {
    const metadata = buildSafeInsForgeRequestMetadata(input, init);
    const attemptKey = `${metadata.method} ${metadata.endpointCategory}`;
    const retryAttempt = (attemptsByRequest.get(attemptKey) ?? 0) + 1;
    attemptsByRequest.set(attemptKey, retryAttempt);
    const startedAt = performance.now();
    let status: number | null = null;

    try {
      const response = await fetchImpl(input, init);
      status = response.status;

      return response;
    } catch (error) {
      throw error;
    } finally {
      timer.recordSpan(
        `insforge.${metadata.operationCategory}`,
        performance.now() - startedAt,
        {
          ...metadata,
          status,
          retryAttempt,
          retryCount: retryAttempt - 1,
        },
      );
    }
  }) as typeof fetch;
}

export function buildSafeInsForgeRequestMetadata(
  input: FetchInput,
  init?: FetchInit,
): ApiTimingAttributes & {
  method: string;
  operationCategory: string;
  endpointCategory: string;
} {
  const method = getRequestMethod(input, init);
  const url = readUrl(input);
  const pathname = url?.pathname ?? "unknown";
  const endpointCategory = `${sanitizePath(pathname)}${safeQueryKeySuffix(url)}`;
  const operationCategory = categorizeOperation(pathname);

  return {
    method,
    operationCategory,
    endpointCategory,
  };
}

function getRequestMethod(input: FetchInput, init?: FetchInit) {
  const method =
    init?.method ??
    (typeof Request !== "undefined" && input instanceof Request
      ? input.method
      : "GET");

  return method.toUpperCase();
}

function readUrl(input: FetchInput) {
  try {
    if (typeof input === "string" || input instanceof URL) {
      return new URL(input);
    }

    if (typeof Request !== "undefined" && input instanceof Request) {
      return new URL(input.url);
    }
  } catch {
    return null;
  }

  return null;
}

function categorizeOperation(pathname: string) {
  const lowerPath = pathname.toLowerCase();

  if (lowerPath.includes("auth")) {
    return "auth";
  }

  if (
    lowerPath.includes("database") ||
    lowerPath.includes("postgrest") ||
    lowerPath.includes("rest")
  ) {
    return "database";
  }

  if (lowerPath.includes("storage")) {
    return "storage";
  }

  if (lowerPath.includes("function")) {
    return "functions";
  }

  return "api";
}

function sanitizePath(pathname: string) {
  return pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => sanitizePathSegment(segment))
    .join("/") || "root";
}

function sanitizePathSegment(segment: string) {
  if (isLikelyIdentifier(segment) || isLikelySecret(segment)) {
    return ":id";
  }

  return encodeURIComponent(segment);
}

function isLikelyIdentifier(segment: string) {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      segment,
    ) ||
    /^\d+$/.test(segment) ||
    (segment.length > 48 && /^[A-Za-z0-9._~-]+$/.test(segment))
  );
}

function isLikelySecret(segment: string) {
  return /token|secret|key|password|cookie/i.test(segment);
}

function safeQueryKeySuffix(url: URL | null) {
  if (!url || url.searchParams.size === 0) {
    return "";
  }

  const keys = Array.from(new Set(Array.from(url.searchParams.keys())))
    .map((key) => sanitizeQueryKey(key))
    .filter(Boolean)
    .sort();

  return keys.length > 0 ? `?keys=${keys.join(",")}` : "";
}

function sanitizeQueryKey(key: string): string {
  if (isLikelySecret(key)) {
    return "redacted";
  }

  return key.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export function isSafeTimingAttribute(value: ApiTimingAttribute): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

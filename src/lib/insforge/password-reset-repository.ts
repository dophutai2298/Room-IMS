import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import type {
  ExchangePasswordResetCodeResult,
  PasswordResetAccount,
  PasswordResetRepository,
} from "@/lib/auth/password-reset-repository";
import { appError, fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeAdminClient } from "./admin";
import { createInsForgeServerClient } from "./server";

type QueryResponse<T> = {
  data: T | null;
  error: unknown;
};

type AppUserPasswordResetRow = {
  email: string;
  status?: "active" | "disabled" | null;
};

export function createInsForgePasswordResetRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): PasswordResetRepository {
  return {
    async sendResetPasswordEmail(input) {
      const work = () => sendResetPasswordEmailWithInsForge({ ...input, timer });

      return timer
        ? timer.measure("repository.insforge.password-reset-email-send", work)
        : work();
    },
    async readPasswordResetAccount(input) {
      const work = () => readPasswordResetAccountFromInsForge({ ...input, timer });

      return timer
        ? timer.measure("repository.insforge.password-reset-account-read", work)
        : work();
    },
    async exchangeResetPasswordToken(input) {
      const work = () => exchangeResetPasswordTokenWithInsForge({ ...input, timer });

      return timer
        ? timer.measure("repository.insforge.password-reset-token-exchange", work)
        : work();
    },
    async resetPassword(input) {
      const work = () => resetPasswordWithInsForge({ ...input, timer });

      return timer
        ? timer.measure("repository.insforge.password-reset-complete", work)
        : work();
    },
  };
}

async function sendResetPasswordEmailWithInsForge({
  email,
  redirectTo,
  timer,
}: {
  email: string;
  redirectTo?: string;
  timer?: ApiTimer;
}): Promise<AppResult<{ requested: true }>> {
  try {
    const client = await createInsForgeServerClient({ timer });
    const result = await client.auth.sendResetPasswordEmail({
      email,
      ...(redirectTo ? { redirectTo } : {}),
    });

    if (result.error) {
      if (isEmailEnumerationSafeResetRequestError(result.error)) {
        return ok({ requested: true });
      }

      return fail(result.error, "Could not send password reset OTP");
    }

    return ok({ requested: true });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function readPasswordResetAccountFromInsForge({
  email,
  timer,
}: {
  email: string;
  timer?: ApiTimer;
}): Promise<AppResult<PasswordResetAccount | null>> {
  try {
    const client = createInsForgeAdminClient({ timer });
    const response = (await client.database
      .from("app_users")
      .select("email, status")
      .eq("email", email)
      .limit(1)) as QueryResponse<AppUserPasswordResetRow[]>;

    if (response.error) {
      return fail(response.error, "Could not read password reset account");
    }

    const row = response.data?.[0];

    if (!row) {
      return ok(null);
    }

    return ok({
      email: row.email,
      status: row.status === "disabled" ? "disabled" : "active",
    });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function exchangeResetPasswordTokenWithInsForge({
  code,
  email,
  timer,
}: {
  email: string;
  code: string;
  timer?: ApiTimer;
}): Promise<AppResult<ExchangePasswordResetCodeResult>> {
  try {
    const client = await createInsForgeServerClient({ timer });
    const result = await client.auth.exchangeResetPasswordToken({ email, code });

    if (result.error) {
      const resetError = passwordResetProviderError(result.error);

      if (resetError) {
        return resetError;
      }

      return fail(result.error, "Could not verify password reset OTP");
    }

    if (!result.data) {
      return fail(null, "InsForge returned no password reset token");
    }

    return ok({
      token: result.data.token,
      expiresAt: result.data.expiresAt,
    });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function resetPasswordWithInsForge({
  newPassword,
  timer,
  token,
}: {
  token: string;
  newPassword: string;
  timer?: ApiTimer;
}): Promise<AppResult<{ reset: true }>> {
  try {
    const client = await createInsForgeServerClient({ timer });
    const result = await client.auth.resetPassword({
      newPassword,
      otp: token,
    });

    if (result.error) {
      const resetError = passwordResetProviderError(result.error);

      if (resetError) {
        return resetError;
      }

      return fail(result.error, "Could not reset password");
    }

    return ok({ reset: true });
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

function isEmailEnumerationSafeResetRequestError(error: unknown) {
  if (!isInsForgeAuthErrorLike(error)) {
    return false;
  }

  const fingerprint = `${String(error.error)} ${error.message}`.toLowerCase();
  const mentionsMissingUser =
    fingerprint.includes("user_not_found") ||
    fingerprint.includes("email_not_found") ||
    fingerprint.includes("account_not_found") ||
    /(user|email|account).*(not found|not_found)/.test(fingerprint) ||
    /(not found|not_found).*(user|email|account)/.test(fingerprint);

  return error.statusCode === 404 && mentionsMissingUser;
}

function passwordResetProviderError(error: unknown): AppResult<never> | null {
  if (!isInsForgeAuthErrorLike(error) || error.statusCode < 400 || error.statusCode >= 500) {
    return null;
  }

  const fingerprint = `${String(error.error)} ${error.message}`.toLowerCase();
  const isExpired =
    fingerprint.includes("expired") ||
    fingerprint.includes("ttl") ||
    fingerprint.includes("timeout");

  return appError({
    message: isExpired
      ? "Reset token expired. Please request a new OTP."
      : "OTP or reset token is invalid. Please request a new OTP.",
    code: isExpired ? "PASSWORD_RESET_EXPIRED" : "PASSWORD_RESET_INVALID",
    statusCode: 400,
    nextActions: "Use the resend OTP action and verify the latest code.",
  });
}

function isInsForgeAuthErrorLike(error: unknown): error is {
  error: unknown;
  message: string;
  statusCode: number;
} {
  return (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    "message" in error &&
    "statusCode" in error &&
    typeof (error as { message?: unknown }).message === "string" &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  );
}

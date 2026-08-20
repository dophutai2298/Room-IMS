import { appError, ok, type AppResult } from "@/lib/insforge/errors";
import {
  isValidPasswordResetCode,
  isValidPasswordResetEmail,
  normalizePasswordResetCode,
  normalizePasswordResetEmail,
  normalizePasswordResetToken,
} from "./password-reset-form";
import type {
  ExchangePasswordResetCodeResult,
  PasswordResetRepository,
} from "./password-reset-repository";

const passwordResetCooldownMs = 60_000;
const productResetTokenTtlMs = 10 * 60_000;
const resetRequestCooldowns = new Map<string, number>();
const resetTokenStates = new Map<
  string,
  {
    email: string;
    expiresAtMs: number;
  }
>();

export type PasswordResetRequestResult = {
  requested: true;
  email: string;
  resendAvailableAt: string;
};

export async function requestPasswordResetForOperations({
  repository,
  email,
  now = new Date(),
  redirectTo,
}: {
  repository: PasswordResetRepository;
  email: unknown;
  now?: Date;
  redirectTo?: string;
}): Promise<AppResult<PasswordResetRequestResult>> {
  const normalizedEmail = normalizePasswordResetEmail(email);

  if (!isValidPasswordResetEmail(normalizedEmail)) {
    return passwordResetInputInvalid({
      email: "Nhập email hợp lệ.",
    });
  }

  const cooldown = reservePasswordResetRequest({
    email: normalizedEmail,
    now,
  });

  if (cooldown.error) {
    return cooldown;
  }

  const result = await repository.sendResetPasswordEmail({
    email: normalizedEmail,
    redirectTo,
  });

  if (result.error) {
    resetRequestCooldowns.delete(normalizedEmail);
    return result;
  }

  return ok({
    requested: true,
    email: normalizedEmail,
    resendAvailableAt: cooldown.data.resendAvailableAt,
  });
}

export async function exchangePasswordResetCodeForOperations({
  repository,
  email,
  code,
  now = new Date(),
}: {
  repository: PasswordResetRepository;
  email: unknown;
  code: unknown;
  now?: Date;
}): Promise<AppResult<ExchangePasswordResetCodeResult>> {
  const normalizedEmail = normalizePasswordResetEmail(email);
  const normalizedCode = normalizePasswordResetCode(code);

  if (
    !isValidPasswordResetEmail(normalizedEmail) ||
    !isValidPasswordResetCode(normalizedCode)
  ) {
    return passwordResetInputInvalid({
      email: !isValidPasswordResetEmail(normalizedEmail)
        ? "Nhập email hợp lệ."
        : undefined,
      code: !isValidPasswordResetCode(normalizedCode)
        ? "Nhập mã OTP gồm 6 chữ số."
        : undefined,
    });
  }

  const account = await requireActivePasswordResetAccount({
    repository,
    email: normalizedEmail,
  });

  if (account.error) {
    return account;
  }

  const result = await repository.exchangeResetPasswordToken({
    email: normalizedEmail,
    code: normalizedCode,
  });

  if (result.error) {
    return result;
  }

  const expiresAt = calculateResetTokenExpiresAt({
    now,
    providerExpiresAt: result.data.expiresAt,
  });
  resetTokenStates.set(result.data.token, {
    email: normalizedEmail,
    expiresAtMs: new Date(expiresAt).getTime(),
  });

  return ok({
    token: result.data.token,
    expiresAt,
  });
}

export async function completePasswordResetForOperations({
  repository,
  email,
  newPassword,
  now = new Date(),
  token,
}: {
  repository: PasswordResetRepository;
  email: unknown;
  token: unknown;
  newPassword: unknown;
  now?: Date;
}): Promise<AppResult<{ reset: true }>> {
  const normalizedEmail = normalizePasswordResetEmail(email);
  const resetToken = normalizePasswordResetToken(token);
  const password = typeof newPassword === "string" ? newPassword : "";

  if (
    !isValidPasswordResetEmail(normalizedEmail) ||
    !resetToken ||
    password.length < 8
  ) {
    return passwordResetInputInvalid({
      email: !isValidPasswordResetEmail(normalizedEmail)
        ? "Nhập email hợp lệ."
        : undefined,
      token: !resetToken ? "Reset token is required." : undefined,
      newPassword:
        password.length < 8
          ? "Mật khẩu mới phải có tối thiểu 8 ký tự."
          : undefined,
    });
  }

  const resetState = verifyPasswordResetTokenState({
    email: normalizedEmail,
    now,
    token: resetToken,
  });

  if (resetState.error) {
    return resetState;
  }

  const account = await requireActivePasswordResetAccount({
    repository,
    email: normalizedEmail,
  });

  if (account.error) {
    return account;
  }

  const result = await repository.resetPassword({
    token: resetToken,
    newPassword: password,
  });

  if (result.error) {
    return result;
  }

  resetTokenStates.delete(resetToken);
  return result;
}

function reservePasswordResetRequest({
  email,
  now,
}: {
  email: string;
  now: Date;
}): AppResult<{ resendAvailableAt: string }> {
  const nowMs = now.getTime();
  const resendAvailableAtMs = resetRequestCooldowns.get(email);

  if (resendAvailableAtMs && resendAvailableAtMs > nowMs) {
    const retryAfterSeconds = Math.ceil((resendAvailableAtMs - nowMs) / 1000);

    return appError({
      message: `Vui lòng chờ ${retryAfterSeconds} giây trước khi gửi lại OTP.`,
      code: "PASSWORD_RESET_RATE_LIMITED",
      statusCode: 429,
      nextActions: "Wait for the cooldown to finish before requesting another OTP.",
    });
  }

  const nextResendAvailableAtMs = nowMs + passwordResetCooldownMs;
  resetRequestCooldowns.set(email, nextResendAvailableAtMs);

  return ok({
    resendAvailableAt: new Date(nextResendAvailableAtMs).toISOString(),
  });
}

async function requireActivePasswordResetAccount({
  repository,
  email,
}: {
  repository: PasswordResetRepository;
  email: string;
}): Promise<AppResult<{ active: true }>> {
  const account = await repository.readPasswordResetAccount({ email });

  if (account.error) {
    return account;
  }

  if (!account.data) {
    return passwordResetInvalidState();
  }

  if (account.data.status === "disabled") {
    return appError({
      message: "This account has been disabled by an Admin/Landlord.",
      code: "PASSWORD_RESET_ACCOUNT_DISABLED",
      statusCode: 403,
      nextActions: "Contact an Admin/Landlord if this is unexpected.",
    });
  }

  return ok({ active: true });
}

function verifyPasswordResetTokenState({
  email,
  now,
  token,
}: {
  email: string;
  now: Date;
  token: string;
}): AppResult<{ valid: true }> {
  const state = resetTokenStates.get(token);

  if (!state) {
    return passwordResetInvalidState();
  }

  if (state.email !== email) {
    return appError({
      message: "Reset token does not match this email.",
      code: "PASSWORD_RESET_STATE_MISMATCH",
      statusCode: 400,
      nextActions: "Request a new OTP for the email you want to reset.",
    });
  }

  if (state.expiresAtMs <= now.getTime()) {
    resetTokenStates.delete(token);

    return appError({
      message: "Reset token expired. Please request a new OTP.",
      code: "PASSWORD_RESET_EXPIRED",
      statusCode: 400,
      nextActions: "Use the resend OTP action and verify the latest code.",
    });
  }

  return ok({ valid: true });
}

function calculateResetTokenExpiresAt({
  now,
  providerExpiresAt,
}: {
  now: Date;
  providerExpiresAt: string;
}) {
  const productExpiresAtMs = now.getTime() + productResetTokenTtlMs;
  const providerExpiresAtMs = new Date(providerExpiresAt).getTime();
  const effectiveExpiresAtMs = Number.isFinite(providerExpiresAtMs)
    ? Math.min(productExpiresAtMs, providerExpiresAtMs)
    : productExpiresAtMs;

  return new Date(effectiveExpiresAtMs).toISOString();
}

function passwordResetInputInvalid(fieldErrors: Record<string, string | undefined>) {
  const invalidFields = Object.entries(fieldErrors)
    .filter(([, message]) => Boolean(message))
    .map(([field]) => field);

  return appError({
    message: "Kiểm tra lại thông tin đặt lại mật khẩu.",
    code: "PASSWORD_RESET_INPUT_INVALID",
    statusCode: 422,
    nextActions:
      invalidFields.length > 0
        ? `Fix these fields and try again: ${invalidFields.join(", ")}.`
        : "Fix the highlighted fields and try again.",
  });
}

function passwordResetInvalidState() {
  return appError({
    message: "Reset request is invalid or expired.",
    code: "PASSWORD_RESET_INVALID",
    statusCode: 400,
    nextActions: "Request a new OTP from the login page.",
  });
}

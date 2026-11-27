import { createHash, randomBytes } from "node:crypto";

import {
  isValidPasswordResetCode,
  isValidPasswordResetEmail,
  normalizePasswordResetCode,
  normalizePasswordResetEmail,
  normalizePasswordResetToken,
} from "@/lib/auth/password-reset-form";
import { appError, ok, type AppResult } from "@/lib/insforge/errors";

export type SupabasePasswordResetRepository = {
  reserveRequest(email: string, now: Date): Promise<AppResult<string | null>>;
  sendEmail(email: string): Promise<AppResult<{ requested: true }>>;
  verifyCode(email: string, code: string): Promise<AppResult<{ authUserId: string }>>;
  saveProof(input: {
    tokenHash: string;
    authUserId: string;
    email: string;
    expiresAt: Date;
  }): Promise<AppResult<{ saved: true }>>;
  consumeProof(input: {
    tokenHash: string;
    email: string;
    now: Date;
  }): Promise<AppResult<string | null>>;
  updatePassword(authUserId: string, newPassword: string): Promise<AppResult<{ reset: true }>>;
};

export async function requestSupabasePasswordReset({
  repository,
  email,
  now = new Date(),
}: {
  repository: SupabasePasswordResetRepository;
  email: unknown;
  now?: Date;
}) {
  const normalizedEmail = normalizePasswordResetEmail(email);
  if (!isValidPasswordResetEmail(normalizedEmail)) return invalidInput();

  const reservation = await repository.reserveRequest(normalizedEmail, now);
  if (reservation.error) return reservation;
  if (!reservation.data) {
    return appError({
      message: "Please wait before requesting another OTP.",
      code: "PASSWORD_RESET_RATE_LIMITED",
      statusCode: 429,
    });
  }

  const sent = await repository.sendEmail(normalizedEmail);
  if (sent.error) return sent;
  return ok({ requested: true as const, email: normalizedEmail, resendAvailableAt: reservation.data });
}

export async function exchangeSupabasePasswordResetCode({
  repository,
  email,
  code,
  now = new Date(),
}: {
  repository: SupabasePasswordResetRepository;
  email: unknown;
  code: unknown;
  now?: Date;
}) {
  const normalizedEmail = normalizePasswordResetEmail(email);
  const normalizedCode = normalizePasswordResetCode(code);
  if (!isValidPasswordResetEmail(normalizedEmail) || !isValidPasswordResetCode(normalizedCode)) {
    return invalidInput();
  }

  const verified = await repository.verifyCode(normalizedEmail, normalizedCode);
  if (verified.error) return verified;

  // The recovery session returned by verifyOtp never enters the app cookie jar.
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + 10 * 60_000);
  const saved = await repository.saveProof({
    tokenHash: hashResetToken(token),
    authUserId: verified.data.authUserId,
    email: normalizedEmail,
    expiresAt,
  });
  if (saved.error) return saved;
  return ok({ token, expiresAt: expiresAt.toISOString() });
}

export async function completeSupabasePasswordReset({
  repository,
  email,
  token,
  newPassword,
  now = new Date(),
}: {
  repository: SupabasePasswordResetRepository;
  email: unknown;
  token: unknown;
  newPassword: unknown;
  now?: Date;
}) {
  const normalizedEmail = normalizePasswordResetEmail(email);
  const normalizedToken = normalizePasswordResetToken(token);
  if (!isValidPasswordResetEmail(normalizedEmail) || !normalizedToken ||
      typeof newPassword !== "string" || newPassword.length < 8) {
    return invalidInput();
  }

  const consumed = await repository.consumeProof({
    tokenHash: hashResetToken(normalizedToken), email: normalizedEmail, now,
  });
  if (consumed.error) return consumed;
  if (!consumed.data) {
    return appError({
      message: "Reset request is invalid or expired.",
      code: "PASSWORD_RESET_INVALID",
      statusCode: 400,
    });
  }
  return repository.updatePassword(consumed.data, newPassword);
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function invalidInput() {
  return appError({
    message: "Check password reset information.",
    code: "PASSWORD_RESET_INPUT_INVALID",
    statusCode: 422,
  });
}

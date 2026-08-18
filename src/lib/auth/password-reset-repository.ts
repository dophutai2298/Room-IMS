import type { AppResult } from "@/lib/insforge/errors";

export type PasswordResetAccountStatus = "active" | "disabled";

export type PasswordResetAccount = {
  email: string;
  status: PasswordResetAccountStatus;
};

export type SendPasswordResetEmailInput = {
  email: string;
  redirectTo?: string;
};

export type ExchangePasswordResetCodeInput = {
  email: string;
  code: string;
};

export type ExchangePasswordResetCodeResult = {
  token: string;
  expiresAt: string;
};

export type CompletePasswordResetInput = {
  token: string;
  newPassword: string;
};

export type PasswordResetRepository = {
  sendResetPasswordEmail(
    input: SendPasswordResetEmailInput,
  ): Promise<AppResult<{ requested: true }>>;
  readPasswordResetAccount(input: {
    email: string;
  }): Promise<AppResult<PasswordResetAccount | null>>;
  exchangeResetPasswordToken(
    input: ExchangePasswordResetCodeInput,
  ): Promise<AppResult<ExchangePasswordResetCodeResult>>;
  resetPassword(
    input: CompletePasswordResetInput,
  ): Promise<AppResult<{ reset: true }>>;
};

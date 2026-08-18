export type PasswordResetRequestPayload = {
  email: string;
};

export type PasswordResetCodePayload = {
  email: string;
  code: string;
};

export type PasswordResetCompletionPayload = {
  email: string;
  token: string;
  newPassword: string;
};

export type PasswordResetRequestDraft = {
  email: string;
};

export type PasswordResetCodeDraft = PasswordResetCodePayload;

export type PasswordResetCompletionDraft = PasswordResetCompletionPayload & {
  confirmPassword: string;
};

export type PasswordResetSubmission<TPayload> =
  | { fieldErrors: Record<string, never>; payload: TPayload }
  | { fieldErrors: Record<string, string>; payload: null };

export const passwordResetRequestedMessage =
  "Nếu email đã được cấp tài khoản, hệ thống sẽ gửi mã OTP đặt lại mật khẩu.";

export const passwordResetOtpVerifiedMessage =
  "Mã OTP hợp lệ. Vui lòng nhập mật khẩu mới.";

export const passwordResetSuccessMessage =
  "Đã đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.";

export function preparePasswordResetRequestSubmission({
  email,
}: PasswordResetRequestDraft): PasswordResetSubmission<PasswordResetRequestPayload> {
  const normalizedEmail = normalizePasswordResetEmail(email);
  const fieldErrors: Record<string, string> = {};

  if (!isValidPasswordResetEmail(normalizedEmail)) {
    fieldErrors.email = "Nhập email hợp lệ.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, payload: null };
  }

  return { fieldErrors: {}, payload: { email: normalizedEmail } };
}

export function preparePasswordResetCodeSubmission({
  code,
  email,
}: PasswordResetCodeDraft): PasswordResetSubmission<PasswordResetCodePayload> {
  const normalizedEmail = normalizePasswordResetEmail(email);
  const normalizedCode = normalizePasswordResetCode(code);
  const fieldErrors: Record<string, string> = {};

  if (!isValidPasswordResetEmail(normalizedEmail)) {
    fieldErrors.email = "Nhập email hợp lệ.";
  }

  if (!isValidPasswordResetCode(normalizedCode)) {
    fieldErrors.code = "Nhập mã OTP gồm 6 chữ số.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, payload: null };
  }

  return {
    fieldErrors: {},
    payload: {
      email: normalizedEmail,
      code: normalizedCode,
    },
  };
}

export function preparePasswordResetCompletionSubmission({
  email,
  confirmPassword,
  newPassword,
  token,
}: PasswordResetCompletionDraft): PasswordResetSubmission<PasswordResetCompletionPayload> {
  const normalizedEmail = normalizePasswordResetEmail(email);
  const resetToken = normalizePasswordResetToken(token);
  const fieldErrors: Record<string, string> = {};

  if (!isValidPasswordResetEmail(normalizedEmail)) {
    fieldErrors.email = "Nhập email hợp lệ.";
  }

  if (!resetToken) {
    fieldErrors.token = "Vui lòng xác minh OTP trước khi đổi mật khẩu.";
  }

  if (newPassword.length < 8) {
    fieldErrors.newPassword = "Mật khẩu mới phải có tối thiểu 8 ký tự.";
  }

  if (newPassword !== confirmPassword) {
    fieldErrors.confirmPassword = "Mật khẩu xác nhận không khớp.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, payload: null };
  }

  return {
    fieldErrors: {},
    payload: {
      email: normalizedEmail,
      newPassword,
      token: resetToken,
    },
  };
}

export function normalizePasswordResetEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function normalizePasswordResetCode(code: unknown) {
  return typeof code === "string" ? code.trim() : "";
}

export function normalizePasswordResetToken(token: unknown) {
  return typeof token === "string" ? token.trim() : "";
}

export function isValidPasswordResetEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPasswordResetCode(code: string) {
  return /^\d{6}$/.test(code);
}

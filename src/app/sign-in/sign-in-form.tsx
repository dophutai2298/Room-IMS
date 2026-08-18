"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchAppApi, type AppApiClientError } from "@/lib/api/client";
import { fetchOptionalCurrentAppUser } from "@/lib/auth/client";
import {
  passwordResetOtpVerifiedMessage,
  passwordResetRequestedMessage,
  passwordResetSuccessMessage,
  preparePasswordResetCodeSubmission,
  preparePasswordResetCompletionSubmission,
  preparePasswordResetRequestSubmission,
  type PasswordResetCodePayload,
  type PasswordResetCompletionPayload,
  type PasswordResetRequestPayload,
} from "@/lib/auth/password-reset-form";
import { authQueryKeys } from "@/lib/auth/query-keys";

type SignInMode =
  | "sign-in"
  | "request-password-reset"
  | "verify-password-reset-otp"
  | "complete-password-reset";

type PasswordResetRequestResponse = {
  requested: true;
  email: string;
  resendAvailableAt: string;
};

type PasswordResetExchangeResponse = {
  token: string;
  expiresAt: string;
};

type PasswordResetCompleteResponse = {
  reset: true;
};

export function SignInForm({ nextPath = "/" }: { nextPath?: string }) {
  const [mode, setMode] = useState<SignInMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetTokenExpiresAt, setResetTokenExpiresAt] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetFieldErrors, setResetFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);

  const currentUserQuery = useQuery({
    queryKey: authQueryKeys.currentUser(),
    queryFn: fetchOptionalCurrentAppUser,
    retry: false,
  });
  const signInMutation = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      fetchAppApi<{ signedIn: true }>("/api/auth/sign-in", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    onSuccess: () => {
      window.location.assign(nextPath);
    },
  });
  const requestPasswordResetMutation = useMutation<
    PasswordResetRequestResponse,
    AppApiClientError,
    PasswordResetRequestPayload
  >({
    mutationFn: (payload) =>
      fetchAppApi<PasswordResetRequestResponse>("/api/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      setMode("verify-password-reset-otp");
      setResetEmail(data.email);
      setResetCode("");
      setResetToken("");
      setResetTokenExpiresAt("");
      setNewPassword("");
      setConfirmPassword("");
      setResetFieldErrors({});
      setMessage(passwordResetRequestedMessage);
      setResendCooldownFrom(data.resendAvailableAt);
    },
  });
  const verifyPasswordResetOtpMutation = useMutation<
    PasswordResetExchangeResponse,
    AppApiClientError,
    PasswordResetCodePayload
  >({
    mutationFn: (payload) =>
      fetchAppApi<PasswordResetExchangeResponse>("/api/auth/password-reset/exchange", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      setMode("complete-password-reset");
      setResetToken(data.token);
      setResetTokenExpiresAt(data.expiresAt);
      setResetFieldErrors({});
      setMessage(passwordResetOtpVerifiedMessage);
    },
  });
  const completePasswordResetMutation = useMutation<
    PasswordResetCompleteResponse,
    AppApiClientError,
    PasswordResetCompletionPayload
  >({
    mutationFn: (payload) =>
      fetchAppApi<PasswordResetCompleteResponse>("/api/auth/password-reset/complete", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (_data, variables) => {
      setMode("sign-in");
      setEmail(variables.email);
      setPassword("");
      setResetEmail("");
      setResetCode("");
      setResetToken("");
      setResetTokenExpiresAt("");
      setNewPassword("");
      setConfirmPassword("");
      setResetFieldErrors({});
      setMessage(passwordResetSuccessMessage);
    },
  });

  useEffect(() => {
    if (currentUserQuery.data) {
      window.location.assign(nextPath);
    }
  }, [currentUserQuery.data, nextPath]);

  useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setResendCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [resendCooldownSeconds]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signInMutation.mutate({ email, password });
  }

  function handleRequestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const submission = preparePasswordResetRequestSubmission({
      email: resetEmail || email,
    });

    if (!submission.payload) {
      setResetFieldErrors(submission.fieldErrors);
      return;
    }

    setResetFieldErrors({});
    requestPasswordResetMutation.mutate(submission.payload);
  }

  function handleVerifyPasswordResetOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const submission = preparePasswordResetCodeSubmission({
      email: resetEmail,
      code: resetCode,
    });

    if (!submission.payload) {
      setResetFieldErrors(submission.fieldErrors);
      return;
    }

    setResetFieldErrors({});
    verifyPasswordResetOtpMutation.mutate(submission.payload);
  }

  function handleCompletePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const submission = preparePasswordResetCompletionSubmission({
      email: resetEmail,
      token: resetToken,
      newPassword,
      confirmPassword,
    });

    if (!submission.payload) {
      setResetFieldErrors(submission.fieldErrors);
      return;
    }

    setResetFieldErrors({});
    completePasswordResetMutation.mutate(submission.payload);
  }

  function handleResendPasswordReset() {
    setMessage(null);

    const submission = preparePasswordResetRequestSubmission({
      email: resetEmail,
    });

    if (!submission.payload) {
      setResetFieldErrors(submission.fieldErrors);
      return;
    }

    setResetCode("");
    setResetToken("");
    setResetTokenExpiresAt("");
    setNewPassword("");
    setConfirmPassword("");
    setResetFieldErrors({});
    verifyPasswordResetOtpMutation.reset();
    completePasswordResetMutation.reset();
    requestPasswordResetMutation.mutate(submission.payload);
  }

  function openPasswordResetRequest() {
    setMode("request-password-reset");
    setResetEmail(email);
    setResetCode("");
    setResetToken("");
    setResetTokenExpiresAt("");
    setNewPassword("");
    setConfirmPassword("");
    setResetFieldErrors({});
    setMessage(null);
    signInMutation.reset();
  }

  function returnToSignIn() {
    setMode("sign-in");
    setResetFieldErrors({});
    setMessage(null);
    requestPasswordResetMutation.reset();
    verifyPasswordResetOtpMutation.reset();
    completePasswordResetMutation.reset();
  }

  function setResendCooldownFrom(resendAvailableAt: string) {
    const remainingMs = new Date(resendAvailableAt).getTime() - Date.now();

    setResendCooldownSeconds(Math.max(0, Math.ceil(remainingMs / 1000)));
  }

  if (mode === "request-password-reset") {
    return (
      <form onSubmit={handleRequestPasswordReset} className="space-y-5">
        <SessionStatus
          isError={currentUserQuery.isError}
          isPending={currentUserQuery.isPending}
          onRetry={() => void currentUserQuery.refetch()}
        />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Quên mật khẩu?</h2>
          <p className="text-sm text-muted-foreground">
            Nhập email đã được Admin cấp tài khoản. Nếu email hợp lệ, hệ thống sẽ gửi OTP đặt lại mật khẩu.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="staff@example.com"
            value={resetEmail}
            onChange={(event) => setResetEmail(event.target.value)}
            required
          />
          <FieldError>{resetFieldErrors.email}</FieldError>
        </div>
        {requestPasswordResetMutation.isError && (
          <FeedbackMessage>{requestPasswordResetMutation.error.message}</FeedbackMessage>
        )}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={requestPasswordResetMutation.isPending}
        >
          {requestPasswordResetMutation.isPending ? "Đang gửi OTP..." : "Gửi OTP"}
        </Button>
        <Button
          type="button"
          variant="link"
          className="h-auto w-full p-0"
          onClick={returnToSignIn}
        >
          Quay lại đăng nhập
        </Button>
      </form>
    );
  }

  if (mode === "verify-password-reset-otp") {
    const canResend =
      !requestPasswordResetMutation.isPending && resendCooldownSeconds <= 0;

    return (
      <form onSubmit={handleVerifyPasswordResetOtp} className="space-y-5">
        <SessionStatus
          isError={currentUserQuery.isError}
          isPending={currentUserQuery.isPending}
          onRetry={() => void currentUserQuery.refetch()}
        />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Xác minh OTP</h2>
          <p className="text-sm text-muted-foreground">
            Nhập mã OTP gồm 6 chữ số trong email. Sau khi xác minh thành công, bạn mới nhập mật khẩu mới.
          </p>
        </div>
        {message && <FeedbackMessage tone="success">{message}</FeedbackMessage>}
        <div className="space-y-2">
          <Label htmlFor="reset-flow-email">Email</Label>
          <Input
            id="reset-flow-email"
            name="email"
            type="email"
            autoComplete="email"
            value={resetEmail}
            onChange={(event) => setResetEmail(event.target.value)}
            required
          />
          <FieldError>{resetFieldErrors.email}</FieldError>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reset-code">Mã OTP</Label>
          <Input
            id="reset-code"
            name="code"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder="123456"
            value={resetCode}
            onChange={(event) => setResetCode(event.target.value)}
            required
          />
          <FieldError>{resetFieldErrors.code}</FieldError>
        </div>
        {verifyPasswordResetOtpMutation.isError && (
          <FeedbackMessage>
            {formatPasswordResetError(verifyPasswordResetOtpMutation.error)}
          </FeedbackMessage>
        )}
        {requestPasswordResetMutation.isError && (
          <FeedbackMessage>
            {formatPasswordResetError(requestPasswordResetMutation.error)}
          </FeedbackMessage>
        )}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={verifyPasswordResetOtpMutation.isPending}
        >
          {verifyPasswordResetOtpMutation.isPending
            ? "Đang xác minh OTP..."
            : "Xác minh OTP"}
        </Button>
        <PasswordResetSecondaryActions
          canResend={canResend}
          isResending={requestPasswordResetMutation.isPending}
          onResend={handleResendPasswordReset}
          onReturn={returnToSignIn}
          resendCooldownSeconds={resendCooldownSeconds}
        />
      </form>
    );
  }

  if (mode === "complete-password-reset") {
    const canResend =
      !requestPasswordResetMutation.isPending && resendCooldownSeconds <= 0;

    return (
      <form onSubmit={handleCompletePasswordReset} className="space-y-5">
        <SessionStatus
          isError={currentUserQuery.isError}
          isPending={currentUserQuery.isPending}
          onRetry={() => void currentUserQuery.refetch()}
        />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Đặt lại mật khẩu</h2>
          <p className="text-sm text-muted-foreground">
            OTP đã được xác minh. Reset token sẽ hết hạn sau tối đa 5 phút, và thao tác này không tự đăng nhập.
          </p>
        </div>
        {message && <FeedbackMessage tone="success">{message}</FeedbackMessage>}
        {resetTokenExpiresAt && (
          <p className="rounded-2xl border border-border/70 bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
            Hạn đổi mật khẩu: {formatExpiryTime(resetTokenExpiresAt)}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="reset-complete-email">Email</Label>
          <Input
            id="reset-complete-email"
            name="email"
            type="email"
            autoComplete="email"
            value={resetEmail}
            disabled
            readOnly
          />
          <FieldError>{resetFieldErrors.email}</FieldError>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">Mật khẩu mới</Label>
          <Input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Tối thiểu 8 ký tự"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          <FieldError>{resetFieldErrors.newPassword}</FieldError>
          <FieldError>{resetFieldErrors.token}</FieldError>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Xác nhận mật khẩu</Label>
          <Input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu mới"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
          <FieldError>{resetFieldErrors.confirmPassword}</FieldError>
        </div>
        {completePasswordResetMutation.isError && (
          <FeedbackMessage>
            {formatPasswordResetError(completePasswordResetMutation.error)}
          </FeedbackMessage>
        )}
        {requestPasswordResetMutation.isError && (
          <FeedbackMessage>
            {formatPasswordResetError(requestPasswordResetMutation.error)}
          </FeedbackMessage>
        )}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={completePasswordResetMutation.isPending}
        >
          {completePasswordResetMutation.isPending
            ? "Đang đổi mật khẩu..."
            : "Đổi mật khẩu"}
        </Button>
        <PasswordResetSecondaryActions
          canResend={canResend}
          isResending={requestPasswordResetMutation.isPending}
          onResend={handleResendPasswordReset}
          onReturn={returnToSignIn}
          resendCooldownSeconds={resendCooldownSeconds}
        />
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <SessionStatus
        isError={currentUserQuery.isError}
        isPending={currentUserQuery.isPending}
        onRetry={() => void currentUserQuery.refetch()}
      />
      {message && <FeedbackMessage tone="success">{message}</FeedbackMessage>}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="landlord@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">Mật khẩu</Label>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={openPasswordResetRequest}
          >
            Quên mật khẩu?
          </Button>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      {signInMutation.isError && (
        <FeedbackMessage>{signInMutation.error.message}</FeedbackMessage>
      )}
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={signInMutation.isPending}
      >
        {signInMutation.isPending
          ? "Đang đăng nhập..."
          : "Đăng nhập"}
      </Button>
    </form>
  );
}

function SessionStatus({
  isError,
  isPending,
  onRetry,
}: {
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
}) {
  if (isPending) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Đang kiểm tra phiên đăng nhập...
      </p>
    );
  }

  if (!isError) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm">
      <p className="text-destructive">Không thể kiểm tra phiên hiện tại.</p>
      <Button
        type="button"
        variant="link"
        className="mt-1 h-auto p-0"
        onClick={onRetry}
      >
        Thử lại
      </Button>
    </div>
  );
}

function PasswordResetSecondaryActions({
  canResend,
  isResending,
  onResend,
  onReturn,
  resendCooldownSeconds,
}: {
  canResend: boolean;
  isResending: boolean;
  onResend: () => void;
  onReturn: () => void;
  resendCooldownSeconds: number;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        type="button"
        variant="outline"
        className="flex-1"
        disabled={!canResend}
        onClick={onResend}
      >
        {isResending
          ? "Đang gửi lại..."
          : resendCooldownSeconds > 0
            ? `Gửi lại OTP sau ${resendCooldownSeconds}s`
            : "Gửi lại OTP"}
      </Button>
      <Button
        type="button"
        variant="link"
        className="flex-1"
        onClick={onReturn}
      >
        Quay lại đăng nhập
      </Button>
    </div>
  );
}

function FieldError({ children }: { children?: string }) {
  if (!children) {
    return null;
  }

  return <p className="text-xs text-destructive">{children}</p>;
}

function FeedbackMessage({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "success";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "border-destructive/25 bg-destructive/10 text-destructive";

  return (
    <p className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>
      {children}
    </p>
  );
}

function formatPasswordResetError(error: AppApiClientError) {
  if (
    error.code === "PASSWORD_RESET_EXPIRED" ||
    error.code === "PASSWORD_RESET_INVALID"
  ) {
    return "Mã OTP không hợp lệ hoặc phiên đặt lại mật khẩu đã hết hạn. Vui lòng gửi lại OTP và thử lại.";
  }

  if (error.code === "PASSWORD_RESET_STATE_MISMATCH") {
    return "Email và phiên đặt lại mật khẩu không khớp. Vui lòng gửi lại OTP.";
  }

  return error.message;
}

function formatExpiryTime(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

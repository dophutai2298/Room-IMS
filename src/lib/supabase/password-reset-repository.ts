import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { appError, fail, ok, type AppResult, toAppBackendError } from "@/lib/insforge/errors";
import type { SupabasePasswordResetRepository } from "./password-reset-service";
import { createSupabaseAdminClient } from "./admin";
import { getSupabasePublicConfig } from "./config";

function createEphemeralAuthClient() {
  const { url, publishableKey } = getSupabasePublicConfig();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createSupabasePasswordResetRepository(): SupabasePasswordResetRepository {
  return {
    async reserveRequest(email) {
      try {
        const admin = createSupabaseAdminClient();
        const emailKey = createHash("sha256").update(email).digest("hex");
        const result = await admin.rpc("reserve_password_reset_request", {
          p_email_key: emailKey,
        });
        if (result.error) return fail(result.error, "Could not reserve password reset request");
        return ok(typeof result.data === "string" ? result.data : null);
      } catch (error) { return { data: null, error: toAppBackendError(error) }; }
    },
    async sendEmail(email) {
      try {
        const client = createEphemeralAuthClient();
        const result = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/sign-in`,
        });
        if (result.error) return fail(result.error, "Could not send password reset OTP");
        return ok({ requested: true });
      } catch (error) { return { data: null, error: toAppBackendError(error) }; }
    },
    async verifyCode(email, code) {
      try {
        const client = createEphemeralAuthClient();
        const verified = await client.auth.verifyOtp({ email, token: code, type: "recovery" });
        if (verified.error || !verified.data.user ||
            verified.data.user.email?.toLowerCase() !== email) {
          return invalidReset();
        }
        const admin = createSupabaseAdminClient();
        const appUser = await admin.from("app_users").select("id, status")
          .eq("auth_user_id", verified.data.user.id)
          .eq("email", email).maybeSingle();
        if (appUser.error) return fail(appUser.error, "Could not verify password reset account");
        if (!appUser.data || appUser.data.status !== "active") return invalidReset();
        return ok({ authUserId: verified.data.user.id });
      } catch (error) { return { data: null, error: toAppBackendError(error) }; }
    },
    async saveProof(input) {
      try {
        const admin = createSupabaseAdminClient();
        const result = await admin.from("password_reset_proofs").insert({
          token_hash: input.tokenHash,
          auth_user_id: input.authUserId,
          email: input.email,
          expires_at: input.expiresAt.toISOString(),
        });
        return result.error
          ? fail(result.error, "Could not save password reset proof")
          : ok({ saved: true });
      } catch (error) { return { data: null, error: toAppBackendError(error) }; }
    },
    async consumeProof(input) {
      try {
        const admin = createSupabaseAdminClient();
        const result = await admin.rpc("consume_password_reset_proof", {
          p_token_hash: input.tokenHash,
          p_email: input.email,
        });
        if (result.error) return fail(result.error, "Could not consume password reset proof");
        return ok(typeof result.data === "string" ? result.data : null);
      } catch (error) { return { data: null, error: toAppBackendError(error) }; }
    },
    async updatePassword(authUserId, newPassword) {
      try {
        const admin = createSupabaseAdminClient();
        // Confirm only this address after the recipient proved control with the recovery OTP.
        const result = await admin.auth.admin.updateUserById(authUserId, {
          password: newPassword,
          email_confirm: true,
        });
        if (result.error) return fail(result.error, "Could not reset password");
        const ready = await admin.from("app_users").update({ credential_ready: true })
          .eq("auth_user_id", authUserId)
          .eq("status", "active")
          .select("id").maybeSingle();
        if (ready.error) return fail(ready.error, "Password changed but account activation failed");
        if (!ready.data) {
          return appError({
            message: "Password changed but account activation needs reconciliation.",
            code: "APP_CREDENTIAL_ACTIVATION_FAILED",
            statusCode: 502,
          });
        }
        return ok({ reset: true });
      } catch (error) { return { data: null, error: toAppBackendError(error) }; }
    },
  };
}

function invalidReset(): AppResult<never> {
  return appError({
    message: "OTP or reset token is invalid or expired.",
    code: "PASSWORD_RESET_INVALID",
    statusCode: 400,
  });
}

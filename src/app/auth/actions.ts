"use server";

import { createAuthActions } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getInsForgeConfig } from "@/lib/insforge/config";
import { toAppBackendError } from "@/lib/insforge/errors";

export type SignInState = {
  message: string | null;
};

export async function signInWithPassword(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { message: "Email và mật khẩu là bắt buộc." };
  }

  const auth = createAuthActions({
    ...getInsForgeConfig(),
    cookies: await cookies(),
  });

  const { error } = await auth.signInWithPassword({ email, password });

  if (error) {
    return { message: toAppBackendError(error, "Đăng nhập InsForge thất bại.").message };
  }

  redirect("/");
}

export async function signOut() {
  const auth = createAuthActions({
    ...getInsForgeConfig(),
    cookies: await cookies(),
  });

  await auth.signOut();
  redirect("/sign-in");
}

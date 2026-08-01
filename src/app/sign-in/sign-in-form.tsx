"use client";

import { useActionState } from "react";

import { signInWithPassword, type SignInState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SignInState = {
  message: null,
};

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(
    signInWithPassword,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="landlord@example.com"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </div>
      {state.message && (
        <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button className="w-full" size="lg" disabled={isPending}>
        {isPending ? "Đang đăng nhập..." : "Đăng nhập bằng InsForge"}
      </Button>
    </form>
  );
}

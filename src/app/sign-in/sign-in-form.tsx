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
  const [signInState, signInAction, isSigningIn] = useActionState(
    signInWithPassword,
    initialState,
  );

  return (
    <form action={signInAction} className="space-y-5">
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
      {signInState.message && (
        <FeedbackMessage>{signInState.message}</FeedbackMessage>
      )}
      <Button className="w-full" size="lg" disabled={isSigningIn}>
        {isSigningIn ? "Đang đăng nhập..." : "Đăng nhập bằng InsForge"}
      </Button>
    </form>
  );
}

function FeedbackMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {children}
    </p>
  );
}

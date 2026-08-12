"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchAppApi } from "@/lib/api/client";
import { fetchOptionalCurrentAppUser } from "@/lib/auth/client";
import { authQueryKeys } from "@/lib/auth/query-keys";

export function SignInForm({ nextPath = "/" }: { nextPath?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  useEffect(() => {
    if (currentUserQuery.data) {
      window.location.assign(nextPath);
    }
  }, [currentUserQuery.data, nextPath]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signInMutation.mutate({ email, password });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {currentUserQuery.isPending && (
        <p className="text-sm text-muted-foreground" role="status">
          Đang kiểm tra phiên đăng nhập...
        </p>
      )}
      {currentUserQuery.isError && (
        <div className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm">
          <p className="text-destructive">Không thể kiểm tra phiên hiện tại.</p>
          <Button
            type="button"
            variant="link"
            className="mt-1 h-auto p-0"
            onClick={() => void currentUserQuery.refetch()}
          >
            Thử lại
          </Button>
        </div>
      )}
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
        <Label htmlFor="password">Mật khẩu</Label>
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

function FeedbackMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {children}
    </p>
  );
}

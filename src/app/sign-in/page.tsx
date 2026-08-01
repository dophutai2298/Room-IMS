import { redirect } from "next/navigation";

import { SignInForm } from "./sign-in-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAppUser } from "@/lib/insforge/rental-repository";

export default async function SignInPage() {
  const user = await getCurrentAppUser();

  if (user.data) {
    redirect("/");
  }

  return (
    <section className="flex min-h-[calc(100dvh-9rem)] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-sm font-semibold text-primary">InsForge Auth</p>
          <CardTitle className="text-3xl">Đăng nhập vận hành</CardTitle>
          <CardDescription>
            Dùng tài khoản InsForge đã được map vào vai trò Landlord hoặc Staff.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
    </section>
  );
}

import { SignInForm } from "./sign-in-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSafeNextPath } from "@/lib/auth/redirect";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const nextPath = getSafeNextPath((await searchParams).next);

  return (
    <section className="flex min-h-[calc(100dvh-9rem)] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-sm font-semibold text-primary">Quản lý phòng trọ</p>
          <CardTitle className="text-3xl">Đăng nhập hệ thống</CardTitle>
          <CardDescription>
            Đăng nhập bằng tài khoản Admin hoặc Staff đã được cấp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm nextPath={nextPath} />
        </CardContent>
      </Card>
    </section>
  );
}

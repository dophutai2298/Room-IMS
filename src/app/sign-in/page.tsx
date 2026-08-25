import { SignInForm } from "./sign-in-form";
import { PwaInstallButton } from "@/components/pwa-install-button";
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
            Đăng nhập bằng tài khoản Admin đã được cấp. <br/>
            Liên hệ <b>037.924.3337</b> để cấp tài khoản mới.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm nextPath={nextPath} />
          <div className="mt-5 border-t border-white/50 pt-4 dark:border-white/10">
            <PwaInstallButton className="w-full" />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

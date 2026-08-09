import { TenantsDirectoryClient } from "./tenants-directory-client";

export default function TenantsPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <TenantsDirectoryClient />
    </main>
  );
}

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { InvoiceListClient } from "./invoice-list-client";

export default function InvoicesPage() {
  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Thu tiền phòng</p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Hóa đơn & Thu tiền
          </h1>
          {/* <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
           
          </p> */}
        </div>
        <Button variant="default">
          <Link href="/rooms">Chọn phòng để tạo hóa đơn</Link>
        </Button>
      </header>

      <InvoiceListClient />
    </>
  );
}

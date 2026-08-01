import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  invoices,
  invoiceStatusLabel,
  type InvoiceStatus,
} from "@/lib/demo-data";

export default function InvoicesPage() {
  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Thu tiền phòng
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Hóa đơn & Thu tiền
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Table dùng mock data để kiểm tra badge, filter control và trạng thái
            thanh toán trước khi ghi vào InsForge.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select defaultValue="08-2026">
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Chọn kỳ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="08-2026">08/2026</SelectItem>
              <SelectItem value="07-2026">07/2026</SelectItem>
              <SelectItem value="06-2026">06/2026</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary">Lọc hóa đơn</Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách hóa đơn</CardTitle>
          <CardDescription>
            Dữ liệu mẫu cho ticket UI foundation. Ticket 06 sẽ cập nhật trạng
            thái thật.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã HĐ</TableHead>
                <TableHead>Kỳ thu</TableHead>
                <TableHead>Phòng</TableHead>
                <TableHead>Tiền thuê</TableHead>
                <TableHead>Dịch vụ</TableHead>
                <TableHead>Tổng tiền</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-xs">{invoice.id}</TableCell>
                  <TableCell>{invoice.period}</TableCell>
                  <TableCell className="font-medium">{invoice.room}</TableCell>
                  <TableCell className="font-mono">
                    {formatCurrency(invoice.rent)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatCurrency(invoice.utilities)}
                  </TableCell>
                  <TableCell className="font-mono font-semibold">
                    {formatCurrency(invoice.total)}
                  </TableCell>
                  <TableCell>
                    <InvoiceBadge status={invoice.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/rooms/${invoice.room.slice(-3)}`}>
                        {invoice.status === "paid" ? "Xem chi tiết" : "Thu tiền"}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function InvoiceBadge({ status }: { status: InvoiceStatus }) {
  const variant =
    status === "paid" ? "success" : status === "partial" ? "warning" : "destructive";

  return <Badge variant={variant}>{invoiceStatusLabel[status]}</Badge>;
}

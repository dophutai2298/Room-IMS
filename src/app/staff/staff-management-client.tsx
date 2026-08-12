"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchCurrentAppUser } from "@/lib/auth/client";
import { authQueryKeys } from "@/lib/auth/query-keys";
import { fetchAppApi } from "@/lib/api/client";
import type { StaffListItem } from "@/lib/staff/presenter";
import { staffQueryKeys } from "@/lib/staff/query-keys";

export function StaffManagementClient() {
  const currentUserQuery = useQuery({
    queryKey: authQueryKeys.currentUser(),
    queryFn: fetchCurrentAppUser,
  });
  const isLandlord = currentUserQuery.data?.role === "landlord";
  const staffQuery = useQuery({
    queryKey: staffQueryKeys.list(),
    queryFn: () =>
      fetchAppApi<StaffListItem[]>("/api/staff", { cache: "no-store" }),
    enabled: isLandlord,
  });

  if (currentUserQuery.isPending) {
    return <StaffPageSkeleton />;
  }

  if (currentUserQuery.isError) {
    return (
      <StaffError
        message={currentUserQuery.error.message}
        onRetry={() => void currentUserQuery.refetch()}
      />
    );
  }

  if (!isLandlord) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Không có quyền truy cập</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Chỉ Landlord mới có thể xem và cấp tài khoản Staff.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Phân quyền vận hành</p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Quản lý Staff
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Landlord cấp tài khoản đăng nhập cho người hỗ trợ vận hành. Ứng dụng
            không mở đăng ký công khai.
          </p>
        </div>
        <CreateStaffDialog />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách Staff</CardTitle>
        </CardHeader>
        <CardContent>
          {staffQuery.isPending ? (
            <StaffTableSkeleton />
          ) : staffQuery.isError ? (
            <StaffError
              message={staffQuery.error.message}
              onRetry={() => void staffQuery.refetch()}
            />
          ) : staffQuery.data.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
              <p className="font-medium">Chưa có tài khoản Staff</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Chọn “Thêm Staff” để cấp tài khoản đầu tiên.
              </p>
            </div>
          ) : (
            <StaffTable staff={staffQuery.data} />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function CreateStaffDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const createMutation = useMutation({
    mutationFn: (input: {
      displayName: string;
      email: string;
      password: string;
    }) =>
      fetchAppApi<StaffListItem>("/api/staff", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (createdStaff) => {
      queryClient.setQueryData<StaffListItem[]>(staffQueryKeys.list(), (current) =>
        [...(current ?? []), createdStaff].sort((left, right) =>
          left.displayName.localeCompare(right.displayName, "vi"),
        ),
      );
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: staffQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: authQueryKeys.currentUser() }),
      ]);
      toast.success("Đã cấp tài khoản Staff.");
      setDisplayName("");
      setEmail("");
      setPassword("");
      setOpen(false);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate({ displayName, email, password });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          createMutation.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>Thêm Staff</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cấp tài khoản Staff</DialogTitle>
          <DialogDescription>
            Tài khoản được xác nhận bởi Landlord và có thể đăng nhập ngay.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="staff-display-name">Tên hiển thị</Label>
            <Input
              id="staff-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-email">Email</Label>
            <Input
              id="staff-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-password">Mật khẩu ban đầu</Label>
            <Input
              id="staff-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">
              Tối thiểu 8 ký tự. Hãy chuyển mật khẩu cho Staff qua kênh riêng.
            </p>
          </div>
          {createMutation.isError && (
            <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {createMutation.error.message}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createMutation.isPending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Đang tạo..." : "Tạo tài khoản"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StaffTable({ staff }: { staff: StaffListItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Staff</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Ngày cấp</TableHead>
          <TableHead>Vai trò</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {staff.map((member) => (
          <TableRow key={member.id}>
            <TableCell className="font-medium">{member.displayName}</TableCell>
            <TableCell>{member.email}</TableCell>
            <TableCell>{formatDate(member.createdAt)}</TableCell>
            <TableCell>Staff</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StaffError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/25 bg-destructive/10 px-5 py-6">
      <p className="font-medium text-destructive">Không thể tải dữ liệu Staff</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <Button className="mt-4" variant="outline" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  );
}

function StaffPageSkeleton() {
  return (
    <div className="space-y-6" aria-label="Đang tải tài khoản hiện tại">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

function StaffTableSkeleton() {
  return (
    <div className="space-y-3" aria-label="Đang tải danh sách Staff">
      {[0, 1, 2].map((item) => (
        <Skeleton key={item} className="h-12 w-full" />
      ))}
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN").format(date)
    : "—";
}

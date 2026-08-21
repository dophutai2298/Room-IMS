"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
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
import { AppApiClientError, fetchAppApi } from "@/lib/api/client";
import { fetchCurrentAppUser } from "@/lib/auth/client";
import { authQueryKeys } from "@/lib/auth/query-keys";
import { createDataTableColumnHelper } from "@/lib/data-table/tanstack";
import { prepareCreateStaffSubmission } from "@/lib/staff/create-staff-form";
import {
  staffAccountStatusLabel,
  type StaffListItem,
} from "@/lib/staff/presenter";
import { staffQueryKeys } from "@/lib/staff/query-keys";

const staffColumnHelper = createDataTableColumnHelper<StaffListItem>();

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
  const columns = useMemo(
    () =>
      staffColumnHelper.columns([
        staffColumnHelper.accessor("displayName", {
          header: "Staff",
          cell: (info) => <span className="font-medium">{info.getValue()}</span>,
          sortFn: "alphanumeric",
        }),
        staffColumnHelper.accessor("email", {
          header: "Email",
          sortFn: "alphanumeric",
        }),
        staffColumnHelper.accessor("status", {
          header: "Trạng thái",
          cell: (info) => <StaffStatusBadge status={info.getValue()} />,
          enableGlobalFilter: false,
          filterFn: "equalsString",
          sortFn: "alphanumeric",
        }),
        staffColumnHelper.accessor("createdAt", {
          header: "Ngày cấp",
          cell: (info) => formatDate(info.getValue()),
          sortFn: "datetime",
          enableGlobalFilter: false,
        }),
        staffColumnHelper.accessor(() => "Staff", {
          id: "role",
          header: "Vai trò",
          enableGlobalFilter: false,
          enableSorting: false,
        }),
        staffColumnHelper.display({
          id: "actions",
          header: "Thao tác",
          cell: ({ row }) =>
            row.original.status === "active" ? (
              <div className="flex justify-end gap-2">
                <EditStaffDialog staff={row.original} />
                <DeleteStaffButton staff={row.original} />
              </div>
            ) : (
              <span className="block text-right text-xs text-muted-foreground">
                Đã vô hiệu hóa
              </span>
            ),
          enableHiding: false,
          enableSorting: false,
        }),
      ]),
    [],
  );

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
            Chỉ Admin/Landlord mới có thể xem và cấp tài khoản Staff.
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
            Quản lý Nhân viên
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Admin cấp tài khoản đăng nhập cho người hỗ trợ vận hành. Ứng dụng
            không mở đăng ký công khai.
          </p>
        </div>
        <CreateStaffDialog />
      </header>

      <DataTable
        columns={columns}
        data={staffQuery.data ?? []}
        emptyMessage="Chọn Thêm nhân viên để cấp tài khoản đầu tiên."
        emptyTitle="Chưa có tài khoản Nhân viên"
        errorMessage={staffQuery.isError ? staffQuery.error.message : undefined}
        filteredEmptyMessage="Thử đổi từ khóa search theo tên hoặc email."
        filteredEmptyTitle="Không tìm thấy Nhân viên"
        isFetching={staffQuery.isFetching}
        isLoading={staffQuery.isPending}
        onRetry={() => void staffQuery.refetch()}
        statusFilter={{
          columnId: "status",
          label: "Lọc trạng thái",
          allLabel: "Tất cả trạng thái",
          options: [
            { value: "active", label: staffAccountStatusLabel.active },
            { value: "disabled", label: staffAccountStatusLabel.disabled },
          ],
        }}
        searchPlaceholder="Tìm Nhân viên hoặc email..."
        // title="Danh sách Nhân viên"
      />
    </>
  );
}

function CreateStaffDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const createMutation = useMutation<
    StaffListItem,
    AppApiClientError,
    {
      displayName: string;
      email: string;
      password: string;
    }
  >({
    mutationFn: (input) =>
      fetchAppApi<StaffListItem>("/api/staff", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (createdStaff) => {
      queryClient.setQueryData<StaffListItem[]>(staffQueryKeys.list(), (current) =>
        upsertStaffListItem(current, createdStaff),
      );
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: staffQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: authQueryKeys.currentUser() }),
      ]);
      toast.success("Đã cấp tài khoản Staff.");
      setDisplayName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setFieldErrors({});
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submission = prepareCreateStaffSubmission({
      displayName,
      email,
      password,
      confirmPassword,
    });

    if (submission.payload === null) {
      setFieldErrors(submission.fieldErrors);
      return;
    }

    setFieldErrors({});
    createMutation.mutate(submission.payload);
  }

  function resetLocalForm() {
    setDisplayName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFieldErrors({});
    createMutation.reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetLocalForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>Thêm Nhân viên</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cấp tài khoản Nhân viên</DialogTitle>
          <DialogDescription>
            Tài khoản được xác nhận bởi Admin/Landlord và có thể đăng nhập ngay.
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
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  confirmPassword: "",
                }));
              }}
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">
              Tối thiểu 8 ký tự. Hãy chuyển mật khẩu cho Staff qua kênh riêng.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-confirm-password">Xác nhận mật khẩu</Label>
            <Input
              id="staff-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  confirmPassword: "",
                }));
              }}
              minLength={8}
              required
            />
            {fieldErrors.confirmPassword && (
              <p className="text-sm text-destructive">
                {fieldErrors.confirmPassword}
              </p>
            )}
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

function EditStaffDialog({ staff }: { staff: StaffListItem }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(staff.displayName);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const validationMessage =
    displayName.trim().length < 2 ? "Nhập tên Staff tối thiểu 2 ký tự." : null;
  const mutation = useMutation<
    StaffListItem,
    AppApiClientError,
    { displayName: string }
  >({
    mutationFn: (payload) =>
      fetchAppApi<StaffListItem>(`/api/staff/${staff.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (savedStaff) => {
      queryClient.setQueryData<StaffListItem[]>(staffQueryKeys.list(), (current) =>
        upsertStaffListItem(current, savedStaff),
      );
      await queryClient.invalidateQueries({ queryKey: staffQueryKeys.all });
      toast.success("Đã cập nhật Staff.");
      setOpen(false);
    },
    onError: (error) => {
      setServerMessage(error.message);
      toast.error(error.message);
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      setDisplayName(staff.displayName);
      setServerMessage(null);
      mutation.reset();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (validationMessage || mutation.isPending) {
      setServerMessage(validationMessage);
      return;
    }

    setServerMessage(null);
    mutation.mutate({ displayName });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Sửa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cập nhật Staff</DialogTitle>
          <DialogDescription>
            Admin/Landlord có thể chỉnh tên hiển thị của Staff. Email đăng nhập
            vẫn được quản lý bởi InsForge Authentication.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`staff-edit-display-name-${staff.id}`}>
              Tên hiển thị
            </Label>
            <Input
              id={`staff-edit-display-name-${staff.id}`}
              value={displayName}
              disabled={mutation.isPending}
              minLength={2}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setServerMessage(null);
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={staff.email} disabled />
            <p className="text-xs text-muted-foreground">
              Đổi email/mật khẩu Staff sẽ được tách riêng khi InsForge hỗ trợ
              API admin tương ứng.
            </p>
          </div>

          {(validationMessage || serverMessage) && (
            <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {serverMessage ?? validationMessage}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || Boolean(validationMessage)}
            >
              {mutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteStaffButton({ staff }: { staff: StaffListItem }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const mutation = useMutation<StaffListItem, AppApiClientError>({
    mutationFn: () =>
      fetchAppApi<StaffListItem>(`/api/staff/${staff.id}`, {
        method: "DELETE",
      }),
    onSuccess: async (savedStaff) => {
      queryClient.setQueryData<StaffListItem[]>(staffQueryKeys.list(), (current) =>
        upsertStaffListItem(current, savedStaff),
      );
      await queryClient.invalidateQueries({ queryKey: staffQueryKeys.all });
      toast.success("Đã vô hiệu hóa tài khoản Staff.");
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <DeleteConfirmationDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          mutation.reset();
        }
      }}
      trigger={
        <Button type="button" size="sm" variant="destructive">
          Xóa
        </Button>
      }
      title="Xóa Staff?"
      description={
        <>
          Tài khoản {staff.displayName} sẽ bị vô hiệu hóa trong app. Nếu
          InsForge chưa hỗ trợ hard-delete auth user an toàn, hệ thống giữ
          mapping để audit và chặn đăng nhập bằng trạng thái disabled.
        </>
      }
      isPending={mutation.isPending}
      errorMessage={mutation.isError ? mutation.error.message : undefined}
      onConfirm={() => mutation.mutate()}
    />
  );
}

function StaffStatusBadge({ status }: { status: StaffListItem["status"] }) {
  return (
    <Badge variant={status === "active" ? "success" : "secondary"}>
      {staffAccountStatusLabel[status]}
    </Badge>
  );
}

function upsertStaffListItem(
  current: StaffListItem[] | undefined,
  savedStaff: StaffListItem,
) {
  const next = current?.some((staff) => staff.id === savedStaff.id)
    ? current.map((staff) => (staff.id === savedStaff.id ? savedStaff : staff))
    : [...(current ?? []), savedStaff];

  return next.sort((left, right) =>
    left.displayName.localeCompare(right.displayName, "vi"),
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

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN").format(date)
    : "—";
}

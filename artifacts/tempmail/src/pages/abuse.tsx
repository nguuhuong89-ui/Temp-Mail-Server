import { PublicLayout } from "@/components/layout/public-layout";
import { AlertTriangle } from "lucide-react";

export default function AbusePage() {
  return (
    <PublicLayout>
      <div className="container max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <div className="flex items-start gap-3 mb-6">
          <AlertTriangle className="h-7 w-7 text-amber-500 shrink-0 mt-1" />
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Báo cáo lạm dụng</h1>
            <p className="text-muted-foreground mt-1">
              Phát hiện ai đó dùng TempMail để spam, lừa đảo, hoặc phishing? Hãy báo cho chúng tôi.
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 sm:p-6 space-y-4">
          <h2 className="font-semibold text-lg">Thông tin cần cung cấp</h2>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>Địa chỉ TempMail bị tố cáo (ví dụ: <code className="font-mono text-foreground">abc@tempmail.local</code>).</li>
            <li>Mô tả ngắn về hành vi vi phạm.</li>
            <li>Bằng chứng (screenshot, header email, link...).</li>
            <li>Email liên hệ để chúng tôi phản hồi (tuỳ chọn).</li>
          </ul>

          <div className="pt-2 border-t">
            <h2 className="font-semibold mb-2">Gửi báo cáo qua</h2>
            <p className="text-sm">
              Email:{" "}
              <a
                href="mailto:abuse@tempmail.local"
                className="font-mono text-primary hover:underline"
              >
                abuse@tempmail.local
              </a>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Báo cáo được xử lý trong 24–48 giờ. Inbox/domain xác nhận vi phạm sẽ bị chặn ngay lập tức.
            </p>
          </div>
        </div>

        <div className="mt-6 text-sm text-muted-foreground">
          Lưu ý: TempMail không quản lý trực tiếp các custom domain do người dùng thêm vào — chủ sở hữu domain có
          thể gỡ bỏ chúng bất kỳ lúc nào.
        </div>
      </div>
    </PublicLayout>
  );
}

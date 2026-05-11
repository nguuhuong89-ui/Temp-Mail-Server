import { PublicLayout } from "@/components/layout/public-layout";

export default function AcceptableUsePage() {
  return (
    <PublicLayout>
      <div className="container max-w-3xl mx-auto px-4 py-10 sm:py-16 prose prose-neutral dark:prose-invert">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Chính sách sử dụng</h1>
        <p className="text-muted-foreground mb-8">Áp dụng cho mọi inbox tạo qua TempMail.</p>

        <h2 className="text-xl font-semibold mt-8 mb-2">Mục đích</h2>
        <p>
          TempMail cung cấp địa chỉ email <strong>chỉ-nhận tạm thời</strong> để bảo vệ địa chỉ thật của bạn khỏi spam,
          dùng cho việc test, xác thực OTP, đăng ký dịch vụ dùng thử, và bảo vệ quyền riêng tư.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">Được phép</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Nhận mã xác thực (OTP, magic link).</li>
          <li>Test gửi/nhận email cho ứng dụng của bạn.</li>
          <li>Tránh spam khi đăng ký dịch vụ ngắn hạn.</li>
          <li>Bảo vệ quyền riêng tư cá nhân.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-2">Không được phép</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Gian lận, lừa đảo, phishing, hoặc đánh cắp danh tính.</li>
          <li>Lách hệ thống chống lạm dụng của bên thứ ba để tạo tài khoản hàng loạt.</li>
          <li>Vi phạm điều khoản dịch vụ của bất kỳ nền tảng nào.</li>
          <li>Bất kỳ hành vi nào vi phạm pháp luật Việt Nam hoặc quốc tế.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-2">Giới hạn kỹ thuật</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Dịch vụ <strong>chỉ nhận</strong> email — không hỗ trợ gửi đi, bulk mail, hay SMTP relay.</li>
          <li>Inbox tự xóa sau thời gian hết hạn (mặc định 1 giờ, có thể gia hạn).</li>
          <li>Không có cam kết SLA cho người dùng miễn phí.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-2">Hậu quả khi vi phạm</h2>
        <p>
          Inbox và domain vi phạm sẽ bị chặn ngay lập tức. Tài khoản người dùng có thể bị khóa vĩnh viễn. Trong
          trường hợp nghiêm trọng, log sẽ được chuyển cho cơ quan chức năng theo yêu cầu hợp pháp.
        </p>
      </div>
    </PublicLayout>
  );
}

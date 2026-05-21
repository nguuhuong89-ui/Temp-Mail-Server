import { SignUp } from "@clerk/react";
import { PublicLayout } from "@/components/layout/public-layout";
import { Mail } from "lucide-react";
import { Link } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignUpPage() {
  return (
    <PublicLayout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-4 py-12">
        {/* Decorative heading */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-xl shadow-violet-500/30 mb-4">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Tạo tài khoản</h1>
          <p className="text-white/50 text-sm mt-1">
            Đã có tài khoản?{" "}
            <Link href="/sign-in" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
              Đăng nhập ngay
            </Link>
          </p>
        </div>

        {/* Clerk widget */}
        <div className="w-full max-w-md">
          <SignUp
            routing="path"
            path={`${basePath}/sign-up`}
            signInUrl={`${basePath}/sign-in`}
            fallbackRedirectUrl={`${basePath}/account`}
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/40 rounded-2xl",
                headerTitle: "text-white",
                headerSubtitle: "text-white/60",
                socialButtonsBlockButton: "bg-white/8 border border-white/15 text-white hover:bg-white/15 transition-colors",
                socialButtonsBlockButtonText: "text-white/90 font-medium",
                dividerLine: "bg-white/10",
                dividerText: "text-white/40",
                formFieldLabel: "text-white/70",
                formFieldInput: "bg-white/8 border-white/15 text-white placeholder:text-white/30 focus:border-violet-400 focus:ring-violet-400/20",
                formButtonPrimary: "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/30 font-semibold",
                footerActionLink: "text-violet-400 hover:text-violet-300",
                identityPreviewText: "text-white/80",
                identityPreviewEditButtonIcon: "text-white/60",
                formFieldInputShowPasswordButton: "text-white/50 hover:text-white/80",
                alert: "bg-rose-500/15 border-rose-400/30 text-rose-300",
              },
            }}
          />
        </div>
      </div>
    </PublicLayout>
  );
}

import { SignUp } from "@clerk/react";
import { PublicLayout } from "@/components/layout/public-layout";
import { Mail } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignUpPage() {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] px-4 py-12">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-xl shadow-violet-500/30 mb-4">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t("signUp.title")}</h1>
          <p className="text-white/50 text-sm mt-1">
            {t("signUp.hasAccount")}{" "}
            <Link href="/sign-in" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
              {t("signUp.signInNow")}
            </Link>
          </p>
        </div>

        <div className="w-full max-w-md">
          <SignUp
            routing="path"
            path={`${basePath}/sign-up`}
            signInUrl={`${basePath}/sign-in`}
            fallbackRedirectUrl={`${basePath}/account`}
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-2xl shadow-black/40 rounded-2xl border-0",
                formButtonPrimary:
                  "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/20 font-semibold",
                footerActionLink: "text-violet-600 hover:text-violet-500",
              },
            }}
          />
        </div>
      </div>
    </PublicLayout>
  );
}

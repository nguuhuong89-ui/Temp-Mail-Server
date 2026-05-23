import { PublicLayout } from "@/components/layout/public-layout";
import { useTranslation } from "react-i18next";

export default function AcceptableUsePage() {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <div className="container max-w-3xl mx-auto px-4 py-10 sm:py-16 prose prose-neutral dark:prose-invert">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">{t("acceptableUse.title")}</h1>
        <p className="text-muted-foreground mb-8">{t("acceptableUse.subtitle")}</p>

        <h2 className="text-xl font-semibold mt-8 mb-2">{t("acceptableUse.purposeTitle")}</h2>
        <p>{t("acceptableUse.purpose")}</p>

        <h2 className="text-xl font-semibold mt-8 mb-2">{t("acceptableUse.allowedTitle")}</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>{t("acceptableUse.allowed1")}</li>
          <li>{t("acceptableUse.allowed2")}</li>
          <li>{t("acceptableUse.allowed3")}</li>
          <li>{t("acceptableUse.allowed4")}</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-2">{t("acceptableUse.notAllowedTitle")}</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>{t("acceptableUse.notAllowed1")}</li>
          <li>{t("acceptableUse.notAllowed2")}</li>
          <li>{t("acceptableUse.notAllowed3")}</li>
          <li>{t("acceptableUse.notAllowed4")}</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-2">{t("acceptableUse.techTitle")}</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>{t("acceptableUse.tech1")}</li>
          <li>{t("acceptableUse.tech2")}</li>
          <li>{t("acceptableUse.tech3")}</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-2">{t("acceptableUse.consequencesTitle")}</h2>
        <p>{t("acceptableUse.consequences")}</p>
      </div>
    </PublicLayout>
  );
}

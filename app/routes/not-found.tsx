import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "~/components/ui/empty";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>{t("errors.pageNotFound")}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" render={<Link to="/" />} nativeButton={false}>
          {t("common.back")}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

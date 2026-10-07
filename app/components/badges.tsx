import {
  AppleIcon,
  ContainerIcon,
  MonitorIcon,
  SquareTerminalIcon,
  TerminalIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "~/components/ui/badge";
import type { DeployMethod, Platform } from "~/lib/manifest";

export const methodIcons = { docker: ContainerIcon, process: SquareTerminalIcon } as const;
const platformIcons = { linux: TerminalIcon, macos: AppleIcon, windows: MonitorIcon } as const;

export function MethodBadge({ method }: { method: DeployMethod }) {
  const { t } = useTranslation();
  const Icon = methodIcons[method];
  return (
    <Badge variant="outline" data-method={method}>
      <Icon />
      {t(`methods.${method}`)}
    </Badge>
  );
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  const { t } = useTranslation();
  const Icon = platformIcons[platform];
  return (
    <Badge variant="secondary" data-platform={platform}>
      <Icon />
      {t(`platforms.${platform}`)}
    </Badge>
  );
}

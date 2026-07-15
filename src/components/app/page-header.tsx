"use client";

import { DynamicIcon } from "@/components/app/dynamic-icon";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: string;
  iconGradient?: string;
  actions?: React.ReactNode;
  breadcrumb?: { label: string; onClick?: () => void }[];
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon,
  iconGradient = "from-[#003366] to-[#0066AA]",
  actions,
  breadcrumb,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <DynamicIcon name="ChevronRight" className="h-3 w-3" />}
              {b.onClick ? (
                <button
                  onClick={b.onClick}
                  className="hover:text-foreground hover:underline"
                >
                  {b.label}
                </button>
              ) : (
                <span className="font-medium text-foreground">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          {icon && (
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg",
                iconGradient
              )}
            >
              <DynamicIcon name={icon} className="h-6 w-6" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

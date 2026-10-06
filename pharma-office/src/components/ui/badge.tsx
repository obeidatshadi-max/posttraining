import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold leading-4 whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-canvas text-ink-2 ring-1 ring-line",
        good: "bg-good-soft text-good",
        warn: "bg-warn-soft text-warn",
        bad: "bg-bad-soft text-bad",
        critical: "bg-critical text-white",
        brand: "bg-brand-soft text-brand",
        confirmed: "bg-confirmed-soft text-confirmed",
        reported: "bg-reported-soft text-reported",
        estimated: "bg-estimated-soft text-estimated",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

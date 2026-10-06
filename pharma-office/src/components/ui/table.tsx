import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function TableWrap({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("w-full overflow-x-auto", className)} {...props} />;
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function Th({ className, numeric, ...props }: ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line bg-canvas/60 px-3 py-2 text-start text-[11px] font-semibold uppercase tracking-wide text-muted whitespace-nowrap",
        numeric && "text-end",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, numeric, ...props }: ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      className={cn("border-b border-line px-3 py-2 align-top text-ink-2", numeric && "num text-end whitespace-nowrap", className)}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("hover:bg-canvas/50", className)} {...props} />;
}

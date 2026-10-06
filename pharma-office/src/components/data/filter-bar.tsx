import type { ReactNode } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/form";

/** Plain GET form: filters live in the URL, are shareable, and work without JavaScript. */
export function FilterBar({ children, resetHref, applyLabel, resetLabel }: { children: ReactNode; resetHref: string; applyLabel: string; resetLabel: string }) {
  return (
    <form method="get" className="grid grid-cols-2 gap-3 border-b border-line p-4 sm:grid-cols-3 lg:grid-cols-6">
      {children}
      <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-6">
        <Button type="submit" size="sm">
          {applyLabel}
        </Button>
        <Link href={resetHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          {resetLabel}
        </Link>
      </div>
    </form>
  );
}

export function FilterField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

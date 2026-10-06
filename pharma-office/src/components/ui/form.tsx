import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const field =
  "h-9 w-full rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-canvas";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(field, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(field, "pe-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(field, "h-auto min-h-20 py-2", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1 block text-xs font-medium text-ink-2", className)} {...props} />;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-bad">{message}</p>;
}

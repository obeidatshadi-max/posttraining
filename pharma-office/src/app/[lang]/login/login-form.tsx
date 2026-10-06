"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";

export function LoginForm({
  lang,
  labels,
}: {
  lang: string;
  labels: { email: string; password: string; submit: string; submitting: string; invalid: string; invalidInput: string };
}) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="mt-5 space-y-3" noValidate>
      <input type="hidden" name="lang" value={lang} />
      <div>
        <Label htmlFor="email">{labels.email}</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} dir="ltr" />
      </div>
      <div>
        <Label htmlFor="password">{labels.password}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required dir="ltr" />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
          {state.error === "invalid" ? labels.invalid : labels.invalidInput}
        </p>
      ) : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}

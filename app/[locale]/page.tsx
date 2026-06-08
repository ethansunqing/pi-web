import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";

export default function LocaleHome() {
  return (
    <Suspense>
      <AppShell />
    </Suspense>
  );
}

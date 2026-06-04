"use client";

import { PageError } from "@/components/shared/PageError";

export default function SettingsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError resource="your settings" {...props} />;
}

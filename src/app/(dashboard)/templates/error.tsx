"use client";

import { PageError } from "@/components/shared/PageError";

export default function TemplatesError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError resource="email templates" {...props} />;
}

"use client";

import { PageError } from "@/components/shared/PageError";

export default function ApplicationsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError resource="your applications" {...props} />;
}

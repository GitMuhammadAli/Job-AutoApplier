"use client";

import { PageError } from "@/components/shared/PageError";

export default function JobDetailError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError resource="this job" {...props} />;
}

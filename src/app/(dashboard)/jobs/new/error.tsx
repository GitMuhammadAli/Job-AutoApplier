"use client";

import { PageError } from "@/components/shared/PageError";

export default function NewJobError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError resource="the add-job form" {...props} />;
}

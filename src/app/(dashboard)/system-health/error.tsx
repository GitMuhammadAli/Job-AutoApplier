"use client";

import { PageError } from "@/components/shared/PageError";

export default function SystemHealthError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError resource="system health info" {...props} />;
}

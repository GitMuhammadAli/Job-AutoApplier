"use client";

import { PageError } from "@/components/shared/PageError";

export default function AnalyticsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError resource="analytics" {...props} />;
}

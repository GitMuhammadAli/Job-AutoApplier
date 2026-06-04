"use client";

import { PageError } from "@/components/shared/PageError";

export default function ResumesError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError resource="your resumes" {...props} />;
}

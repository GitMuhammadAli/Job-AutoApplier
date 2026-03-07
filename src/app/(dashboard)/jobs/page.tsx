import { redirect } from "next/navigation";

interface PageProps {
  searchParams: {
    keyword?: string;
    source?: string;
  };
}

export default function JobsRedirectPage({ searchParams }: PageProps) {
  const params = new URLSearchParams();

  if (searchParams.keyword) {
    params.set("q", searchParams.keyword);
  }

  if (searchParams.source?.startsWith("devradar")) {
    params.set("ref", searchParams.source);
  }

  const qs = params.toString();
  redirect(`/recommended${qs ? `?${qs}` : ""}`);
}

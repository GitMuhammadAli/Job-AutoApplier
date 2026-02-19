export interface VerifyEmailMXResult {
  valid: boolean;
  hasMX: boolean;
}

export async function verifyMxRecord(domain: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
      { signal: AbortSignal.timeout(3000) }
    );

    if (!response.ok) return false;

    const data = (await response.json()) as {
      Status?: number;
      Answer?: Array<{ type?: number }>;
    };

    return (
      data.Status === 0 &&
      Array.isArray(data.Answer) &&
      data.Answer.length > 0
    );
  } catch {
    return false;
  }
}

export async function verifyEmailMX(email: string): Promise<VerifyEmailMXResult> {
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) return { valid: false, hasMX: false };

  const domain = email.slice(atIndex + 1);
  if (!domain) return { valid: false, hasMX: false };

  const hasMX = await verifyMxRecord(domain);
  return { valid: hasMX, hasMX };
}

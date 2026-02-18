export interface VerifyEmailMXResult {
  valid: boolean;
  hasMX: boolean;
}

export async function verifyEmailMX(email: string): Promise<VerifyEmailMXResult> {
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) {
    return { valid: false, hasMX: false };
  }

  const domain = email.slice(atIndex + 1);
  if (!domain) {
    return { valid: false, hasMX: false };
  }

  try {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;
    const res = await fetch(url);
    const data = (await res.json()) as { Answer?: Array<{ type?: number }> };
    const answers = data.Answer ?? [];
    const hasMX = answers.some((a) => a.type === 15);
    return {
      valid: hasMX,
      hasMX,
    };
  } catch {
    return { valid: false, hasMX: false };
  }
}

// C2: Import skills from DevRadar profile

interface DevRadarSkills {
  skills: string[];
  source: "devradar";
}

export async function importSkillsFromDevRadar(
  devradarToken?: string
): Promise<DevRadarSkills | null> {
  const devradarUrl = process.env.NEXT_PUBLIC_DEVRADAR_URL;
  if (!devradarUrl) return null;

  try {
    // Try the public API first (user's extracted skills from resume)
    const res = await fetch(`${devradarUrl}/api/v1/user/skills`, {
      headers: devradarToken
        ? { Authorization: `Bearer ${devradarToken}` }
        : {},
    });

    if (!res.ok) return null;

    const data = await res.json();
    const skills: string[] = Array.isArray(data)
      ? data.map((s: any) => (typeof s === "string" ? s : s.skill ?? s.name ?? ""))
      : (data.skills ?? []);

    return { skills: skills.filter(Boolean), source: "devradar" };
  } catch {
    return null;
  }
}

// Merge skills without duplicates (case-insensitive)
export function mergeSkills(existing: string[], imported: string[]): string[] {
  const seen = new Set(existing.map(s => s.toLowerCase()));
  const merged = [...existing];

  for (const skill of imported) {
    if (!seen.has(skill.toLowerCase())) {
      seen.add(skill.toLowerCase());
      merged.push(skill);
    }
  }

  return merged;
}

/**
 * Gemini Vision-based job description extractor.
 * Takes an image buffer (photo of a job posting: billboard, newspaper, flyer, screenshot)
 * and returns structured job description data.
 *
 * Requires GEMINI_API_KEY or GOOGLE_CSE_KEY in environment variables.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ExtractedJD {
  title: string;
  company: string;
  location: string | null;
  description: string;
  requirements: string[];
  salary: string | null;
  contactEmail: string | null;
  applyUrl: string | null;
  confidence: number; // 0-1
}

export async function extractJDFromImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ExtractedJD> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_CSE_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or GOOGLE_CSE_KEY required for vision");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString("base64"),
      mimeType,
    },
  };

  const result = await model.generateContent([
    "Extract the job posting from this image. Return JSON with these exact fields: title (job title), company (company name), location (city/country or null), description (full job description text), requirements (array of requirement strings), salary (salary range or null), contactEmail (email to apply or null), applyUrl (application URL or null), confidence (0-1 how confident you are this is a real job posting). If the image is not a job posting, set confidence to 0.",
    imagePart,
  ]);

  const text = result.response.text();

  // Extract JSON from response (may be wrapped in ```json blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse job description from image");
  }

  return JSON.parse(jsonMatch[0]) as ExtractedJD;
}

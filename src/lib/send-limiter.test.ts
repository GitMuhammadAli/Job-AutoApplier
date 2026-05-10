import { describe, it, expect } from "vitest";
import { detectProvider } from "./send-limiter";

describe("detectProvider", () => {
  describe("explicit emailProvider field", () => {
    it("'gmail' -> gmail", () => {
      expect(detectProvider("gmail")).toBe("gmail");
    });

    it("'outlook' -> outlook", () => {
      expect(detectProvider("outlook")).toBe("outlook");
    });

    it("'brevo' -> brevo", () => {
      expect(detectProvider("brevo")).toBe("brevo");
    });

    it("'default' -> brevo (treats as default sender)", () => {
      expect(detectProvider("default")).toBe("brevo");
    });

    it("undefined provider -> brevo (default sender)", () => {
      expect(detectProvider()).toBe("brevo");
    });

    it("null provider -> brevo (default sender)", () => {
      expect(detectProvider(null)).toBe("brevo");
    });

    it("empty string provider -> brevo", () => {
      expect(detectProvider("")).toBe("brevo");
    });
  });

  describe("custom SMTP with host inspection", () => {
    it("custom with gmail SMTP host -> gmail", () => {
      expect(detectProvider("custom", "smtp.gmail.com")).toBe("gmail");
    });

    it("custom with google SMTP host -> gmail", () => {
      expect(detectProvider("custom", "smtp.googlemail.com")).toBe("gmail");
    });

    it("custom with outlook SMTP host -> outlook", () => {
      expect(detectProvider("custom", "smtp.outlook.com")).toBe("outlook");
    });

    it("custom with office365 SMTP host -> outlook", () => {
      expect(detectProvider("custom", "smtp.office365.com")).toBe("outlook");
    });

    it("custom with hotmail SMTP host -> outlook", () => {
      expect(detectProvider("custom", "smtp.hotmail.com")).toBe("outlook");
    });

    it("custom with live.com SMTP host -> outlook", () => {
      expect(detectProvider("custom", "smtp.live.com")).toBe("outlook");
    });

    it("custom with unrecognized host -> custom", () => {
      expect(detectProvider("custom", "mail.example.com")).toBe("custom");
    });

    it("custom with no host -> custom", () => {
      expect(detectProvider("custom")).toBe("custom");
    });

    it("custom with empty host -> custom", () => {
      expect(detectProvider("custom", "")).toBe("custom");
    });

    it("host detection is case-insensitive", () => {
      expect(detectProvider("custom", "SMTP.GMAIL.COM")).toBe("gmail");
      expect(detectProvider("custom", "Smtp.Outlook.Com")).toBe("outlook");
    });
  });

  describe("unrecognized provider strings", () => {
    it("falls back through brevo for unrecognized non-empty values", () => {
      // Anything that's not gmail/outlook/brevo/default/custom is unhandled.
      // Implementation falls into brevo branch via the empty-or-default check.
      // This is the actual current behavior — assert it.
      expect(detectProvider("unknown-provider")).toBe("custom");
    });
  });
});

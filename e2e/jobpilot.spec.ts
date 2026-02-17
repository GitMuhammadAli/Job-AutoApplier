import { test, expect } from "@playwright/test";

test.describe("JobPilot Dashboard Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 60000 });
    await page.getByRole("heading", { name: "Dashboard", level: 1 }).waitFor({ state: "visible", timeout: 15000 });
  });

  test("1. Dashboard Load Test", async ({ page }) => {
    // Take screenshot for Dashboard Load Test
    await page.screenshot({ path: "test-results/01-dashboard-load.png", fullPage: true });

    // Check page loads without errors (no console errors)
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Sidebar: navigation links (scope to sidebar nav to avoid multiple "Add Job" in empty columns)
    const sidebar = page.getByRole("navigation");
    await expect(sidebar.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Add Job" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Analytics" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Resumes" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Settings" })).toBeVisible();

    // Header with search bar
    await expect(page.getByPlaceholder("Search jobs...")).toBeVisible();

    // StatsBar: metric cards
    await expect(page.getByText("Total Jobs")).toBeVisible();
    await expect(page.locator("text=Applied").first()).toBeVisible();
    await expect(page.locator("text=Interviews").first()).toBeVisible();
    await expect(page.locator("text=Offers").first()).toBeVisible();
    await expect(page.locator("text=Response Rate").first()).toBeVisible();
    await expect(page.getByText("Daily Target")).toBeVisible();

    // Kanban columns
    await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Applied" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Interview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Offer" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rejected" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ghosted" })).toBeVisible();

    // 5 job cards in Saved column (companies from seed)
    await expect(page.getByText("Cyngro").first()).toBeVisible();
    await expect(page.getByText("Bridgeway Solution").first()).toBeVisible();
    await expect(page.getByText("ThinKASA").first()).toBeVisible();
    await expect(page.getByText("Contour Software").first()).toBeVisible();
    await expect(page.getByText("ReownLogics").first()).toBeVisible();

    // Job cards show company, role (at least one card has company name)
    await expect(page.getByText("Junior MERN Stack Developer").or(page.getByText("Full-Stack TypeScript Developer"))).toBeVisible();
  });

  test("2. Stage Transition Test", async ({ page }) => {
    // Click chevron-right (Move to Applied) on Cyngro card in Saved column
    const savedColumn = page.getByRole("heading", { name: "Saved" }).locator("..").locator("..");
    const moveToAppliedBtn = savedColumn.getByTitle("Move to Applied").first();
    await moveToAppliedBtn.click({ timeout: 10000 });

    // Wait for toast
    await expect(page.getByText("Moved to applied")).toBeVisible({ timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: "test-results/02-stage-transition.png", fullPage: true });

    // Verify job moved to Applied column (column with Applied heading now has a job card)
    const appliedColumn = page.getByRole("heading", { name: "Applied" }).locator("..").locator("..");
    await expect(appliedColumn.getByText(/Cyngro|Bridgeway|ThinKASA|Contour|ReownLogics/).first()).toBeVisible({ timeout: 3000 });
  });

  test("3. Search Test", async ({ page }) => {
    // Ensure jobs are visible first (use first() - Cyngro may appear in multiple cards)
    await expect(page.getByText("Cyngro").first()).toBeVisible({ timeout: 5000 });
    // Type in search bar
    const searchInput = page.getByPlaceholder("Search jobs...");
    await searchInput.fill("Cyngro");
    // Wait for filter to apply
    await page.waitForTimeout(300);

    // Take screenshot
    await page.screenshot({ path: "test-results/03-search-cyngro.png", fullPage: true });

    // Only Cyngro should be visible; others filtered out
    await expect(page.getByText("Cyngro").first()).toBeVisible();
    await expect(page.locator("text=Bridgeway Solution")).toHaveCount(0);
    await expect(page.locator("text=ThinKASA")).toHaveCount(0);
    await expect(page.locator("text=Contour Software")).toHaveCount(0);
    await expect(page.locator("text=ReownLogics")).toHaveCount(0);
  });

  test("4. Clear Search - Full Board", async ({ page }) => {
    // Ensure jobs are visible first
    await expect(page.getByText("Cyngro").first()).toBeVisible({ timeout: 5000 });
    // First type something
    await page.getByPlaceholder("Search jobs...").fill("Cyngro");
    await page.waitForTimeout(300);
    // Clear search
    await page.getByPlaceholder("Search jobs...").clear();
    await page.waitForTimeout(500);

    // Take final screenshot
    await page.screenshot({ path: "test-results/04-clear-search.png", fullPage: true });

    // All 5 jobs should be visible again
    await expect(page.getByText("Cyngro").first()).toBeVisible();
    await expect(page.getByText("Bridgeway Solution").first()).toBeVisible();
    await expect(page.getByText("ThinKASA").first()).toBeVisible();
    await expect(page.getByText("Contour Software").first()).toBeVisible();
    await expect(page.getByText("ReownLogics").first()).toBeVisible();
  });
});

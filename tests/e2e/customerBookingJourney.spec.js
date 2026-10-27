import { test, expect } from '@playwright/test';

test.describe('End-to-End Customer Booking Journey (Browser Level)', () => {
  test('navigates public booking portal, chooses service, provider, slot, and confirms booking', async ({ page }) => {
    // 1. Visit the public booking portal for the seeded demo business
    await page.goto('/book/luxe-studio');

    // 2. Verify business branding and verification badge
    await expect(page.locator('text=Verified SlotFlow Provider')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Luxe Studio & Spa');

    // 3. Step 1: Select Treatment / Service
    const serviceCard = page.locator('text=Signature Haircut & Styling').first();
    await expect(serviceCard).toBeVisible();
    await serviceCard.click();

    // 4. Step 2: Select Provider
    await expect(page.locator('text=Choose a Provider')).toBeVisible();
    const anyProviderButton = page.locator('text=Any Available Provider').first();
    await expect(anyProviderButton).toBeVisible();
    await anyProviderButton.click();

    // 5. Step 3: Date & Time Slot Selection
    await expect(page.locator('text=Available Start Times')).toBeVisible();

    // Set date to a future weekday (e.g., 7 days ahead to ensure weekday within horizon)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    // If it falls on Sunday (day 0), add another day to make it Monday
    if (futureDate.getDay() === 0) {
      futureDate.setDate(futureDate.getDate() + 1);
    }
    const dateStr = futureDate.toISOString().split('T')[0];

    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill(dateStr);

    // Wait for slots to load or available slot buttons to appear
    const slotButtons = page.locator('button:has-text(":")');
    await slotButtons.first().waitFor({ state: 'visible', timeout: 15000 });

    const availableCount = await slotButtons.count();
    expect(availableCount).toBeGreaterThan(0);

    // Click the first available slot
    const firstSlot = slotButtons.first();
    const selectedSlotText = await firstSlot.innerText();
    await firstSlot.click();

    // Click "Continue to Details"
    const continueButton = page.locator('button:has-text("Continue to Details")');
    await expect(continueButton).toBeVisible();
    await continueButton.click();

    // 6. Step 4: Fill Customer Contact Form
    await expect(page.locator('text=Your Contact Information')).toBeVisible();

    await page.locator('input[placeholder="Jessica Vance"]').fill('QA Automated Customer');
    await page.locator('input[placeholder="jessica@example.com"]').fill('qa-e2e@slotflow.io');
    await page.locator('input[placeholder="+1 (555) 234-5678"]').fill('+1 (555) 987-6543');

    // Submit Booking
    const submitButton = page.locator('button:has-text("Book Appointment")');
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // 7. Step 5: Verify Confirmation State
    await expect(page.locator('text=Appointment Confirmed!')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=QA Automated Customer')).toBeVisible();

    // Verify Confirmation ID and Management Link
    const confirmationIdLocator = page.locator('span.font-mono');
    await expect(confirmationIdLocator).toBeVisible();
    const bookingId = await confirmationIdLocator.innerText();
    expect(bookingId).toMatch(/^[a-f\d]{24}$/i);

    const manageLink = page.locator('a:has-text("Manage or Reschedule Booking")');
    await expect(manageLink).toBeVisible();
    const href = await manageLink.getAttribute('href');
    expect(href).toContain(`/appointments/${bookingId}/manage?token=`);

    // 8. Follow Management Link and Verify Manage Booking Page
    await page.goto(href);
    await expect(page.locator('text=QA Automated Customer')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=CONFIRMED')).toBeVisible();
    await expect(page.locator('text=Cancel Appointment')).toBeVisible();
  });

  test('gracefully displays error screen when accessing non-existent business workspace', async ({ page }) => {
    await page.goto('/book/non-existent-studio-404-xyz');

    await expect(page.locator('text=Workspace Unavailable')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Go to SlotFlow Portal')).toBeVisible();
  });
});

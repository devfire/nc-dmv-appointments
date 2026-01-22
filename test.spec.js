import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://skiptheline.ncdot.gov/Webapp/Appointment/Index/a7ade79b-996d-4971-8766-97feb75254de';

test('navigate to configurable URL', async ({ page }) => {
  // Grant geolocation permission before navigation
  await page.context().grantPermissions(['geolocation'], { origin: BASE_URL });

  // Set geolocation to avoid prompts
  await page.context().setGeolocation({ latitude: 35.7796, longitude: -78.6382 });

  // Navigate to the URL
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  // Wait for SPA to hydrate
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => document.readyState === 'complete');

  // Find the button element
  const makeApptButton = page.locator('button#cmdMakeAppt');
  await expect(makeApptButton).toBeVisible();
  await makeApptButton.click();

  // Find and click Teen Driver Level 1 option
  const teenDriverOption = page.locator('[data-id="10"].QflowObjectItem');
  await expect(teenDriverOption).toBeVisible();
  await teenDriverOption.click();

  // Wait for loading overlay to disappear
  await page.locator('#BlockLoader').waitFor({ state: 'hidden' });

  // Wait a moment for active units to load
  await page.waitForTimeout(2000);
  
  // Find all elements with the specific classes
  const activeUnits = page.locator('.QflowObjectItem.form-control.ui-selectable.Active-Unit.valid');
  const count = await activeUnits.count();
  console.log(`Found ${count} active units`);
  
  // If no active units are available, exit gracefully
  if (count === 0) {
    console.log('No active units available at this time.');
    return;
  }

  // Click each active unit, wait for page load, then go back
  for (let i = 0; i < count; i++) {
    // Re-locate the elements on each iteration (in case page state changed)
    const currentActiveUnits = page.locator('.QflowObjectItem.form-control.ui-selectable.Active-Unit.valid');

    // Get the city name from the active unit
    const cityNameDiv = currentActiveUnits.nth(i).locator('div > div:nth-child(1)');
    const cityName = await cityNameDiv.textContent().catch(() => 'Unknown');

    // console.log(`Clicking active unit ${i + 1} of ${count}: ${cityName}`);

    await currentActiveUnits.nth(i).click();

    // Wait for loading overlay to disappear (indicating page transition completed)
    await page.locator('#BlockLoader').waitFor({ state: 'hidden', timeout: 10000 });

    // Wait for network to be idle (all requests completed)
    await page.waitForLoadState('networkidle');

    // Additional wait to ensure SPA is fully rendered
    await page.waitForTimeout(1000);

    // Check for appointment availability
    const noAppointmentsError = page.locator('span.field-validation-error', {
      hasText: 'This office does not currently have any appointments available in the next 7 days'
    });
    const isErrorVisible = await noAppointmentsError.isVisible().catch(() => false);

    // Also check for hidden input that indicates no available dates
    const errorHiddenInput = await page.locator('input[name="StepControls[1].FieldName"][value="ErrorNoAvaiableDates"]').count();
    const hasNoAvailableDates = isErrorVisible || errorHiddenInput > 0;


    if (hasNoAvailableDates) {
      console.log(`${cityName}: Nothing available`);
    } else {
      console.log(`${cityName}: Appointments available`);

      // Take screenshot for debugging
      await page.screenshot({ path: `test-results/appointment-${cityName.replace(/[^a-z0-9]/gi, '-')}.png`, fullPage: true }).catch(() => { });
    }

    // console.log(`Active unit ${i + 1} fully loaded, going back`);

    // Go back to the previous page
    await page.goBack();

    // Wait for loading overlay to disappear after going back
    await page.locator('#BlockLoader').waitFor({ state: 'hidden', timeout: 10000 });

    // Wait for active units to appear again
    await page.waitForSelector('.QflowObjectItem.form-control.ui-selectable.Active-Unit.valid', { timeout: 10000 });
  }

  console.log(`Completed clicking all ${count} active units`);

  // Verify navigation was successful
  expect(page.url()).toContain(new URL(BASE_URL).hostname);
});

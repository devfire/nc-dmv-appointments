 import { test, expect } from '@playwright/test';
import { AppointmentPage } from '../pages/AppointmentPage.js';
import { TestHelpers } from '../utils/test-helpers.js';

// Configuration
const BASE_URL = process.env.BASE_URL || 'https://skiptheline.ncdot.gov/Webapp/Appointment/Index/a7ade79b-996d-4971-8766-97feb75254de';
const GEOLOCATION = {
  latitude: parseFloat(process.env.LATITUDE) || 35.7796,  // Raleigh, NC
  longitude: parseFloat(process.env.LONGITUDE) || -78.6382
};
const APPOINTMENT_TYPE_ID = process.env.APPOINTMENT_TYPE_ID || '10'; // Default to teen driver
const APPOINTMENT_TYPE_TEXT = process.env.APPOINTMENT_TYPE_TEXT || null;

test.describe('NC DMV Appointment Checker', () => {
  let appointmentPage;

  test.beforeEach(async ({ page }) => {
    appointmentPage = new AppointmentPage(page);

    // Setup and navigate
    await test.step('Navigate to appointment page', async () => {
      await appointmentPage.navigateAndSetup(BASE_URL, GEOLOCATION);
    });
  });

  test('should verify initial page loads successfully', async ({ page }) => {
    await test.step('Verify page elements', async () => {
      await expect(appointmentPage.makeApptButton).toBeVisible({ timeout: 10000 });
      expect(page.url()).toContain('skiptheline.ncdot.gov');
    });
  });

  test('should check all locations for appointments', async ({ page }) => {
    // Navigate to appointment selection
    let hasActiveUnits = false;
    await test.step('Select appointment type', async () => {
      await appointmentPage.clickMakeAppointment();
      await appointmentPage.selectAppointmentType(APPOINTMENT_TYPE_ID, APPOINTMENT_TYPE_TEXT);
      hasActiveUnits = await appointmentPage.waitForActiveUnitsLoad();
    });

    // Get available locations
    const count = await appointmentPage.getActiveUnitsCount();
    TestHelpers.logWithTimestamp(`Found ${count} locations to check`);

    // Check each location
    const results = [];

    if (count === 0 || !hasActiveUnits) {
      // Handle no locations available gracefully
      await test.step('Handle no locations', async () => {
        TestHelpers.logWithTimestamp('No locations available at this time');
        expect(count).toBe(0); // This is still a valid test result
      });
    } else {
      for (let i = 0; i < count; i++) {
        await test.step(`Check location ${i + 1}/${count}`, async () => {
          const result = await appointmentPage.checkLocationAvailability(i);
          results.push(result);

          // Get appointment details if available
          let status = result.isAvailable ? '✓ Appointments available' : '✗ Nothing available';
          if (result.isAvailable) {
            const apiData = appointmentPage.getAppointmentApiData();
            if (apiData && apiData.availableDates && apiData.availableDates.length > 0) {
              const dateStr = apiData.availableDates.join(', ');
              status += ` (earliest: ${dateStr})`;
            }

            // Get available time slots for the first date
            try {
              const dateSelected = await appointmentPage.selectDate(0);
              if (dateSelected) {
                const timeSlots = await appointmentPage.getTimeSlots();
                if (timeSlots.length > 0) {
                  const times = timeSlots.map(slot => slot.datetime).slice(0, 5); // Show first 5 times
                  const moreText = timeSlots.length > 5 ? ` (+${timeSlots.length - 5} more)` : '';
                  status += `\n  Available times: ${times.join(', ')}${moreText}`;
                }
              }
            } catch (error) {
              console.warn(`Could not retrieve time slots: ${error.message}`);
            }
          }
          console.log(`${result.cityName}: ${status}`);

          // Take screenshot if appointments are available
          if (result.isAvailable) {
            const filename = `appointment-${TestHelpers.sanitizeFilename(result.cityName)}.png`;
            await appointmentPage.takeScreenshot(filename);
          }

          // Navigate back if not the last location
          if (i < count - 1) {
            await appointmentPage.navigateBack();
          }
        });
      }

      // Print summary
      await test.step('Generate summary report', async () => {
        const summary = TestHelpers.formatResults(results);
        TestHelpers.printSummary(summary);

        // Verify test completed successfully
        expect(summary.total).toBe(count);
        expect(results).toHaveLength(count);
      });
    }
  });

  test('should handle navigation and verify page elements', async ({ page }) => {
    await test.step('Verify initial page elements', async () => {
      // Verify make appointment button is visible and clickable
      await expect(appointmentPage.makeApptButton).toBeVisible();
      await expect(appointmentPage.makeApptButton).toBeEnabled();

      // Verify URL is correct
      expect(page.url()).toContain('skiptheline.ncdot.gov');
    });
  });
});

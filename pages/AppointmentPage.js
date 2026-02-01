export class AppointmentPage {
  constructor(page) {
    this.page = page;
    // Locators
    this.makeApptButton = page.locator('button#cmdMakeAppt');
    this.blockLoader = page.locator('#BlockLoader');
    this.activeUnits = page.locator('.QflowObjectItem.form-control.ui-selectable.Active-Unit.valid');
    this.noAppointmentsError = page.locator('span.field-validation-error');
    this.errorHiddenInput = page.locator('input[name="StepControls[1].FieldName"][value="ErrorNoAvaiableDates"]');
    this.appointmentHeading = page.locator('text=Please select date and time');
    this.calendarDates = page.locator('.calendar-day, .ui-datepicker-calendar td:not(.ui-datepicker-unselectable)');

    // API response storage
    this.lastApiResponse = null;
    this.appointmentApiData = null;
  }

  /**
   * Setup API response interception to capture appointment data
   */
  async setupApiInterception() {
    // Intercept API responses for appointment calendar data
    await this.page.route('**/Webapp/Appointment/AmendStep*', async (route, request) => {
      // Continue with the request
      const response = await route.fetch();

      // Capture the response
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('text/html') || contentType.includes('application/json')) {
          const responseBody = await response.text();

          // Store the response for later analysis
          this.lastApiResponse = {
            url: request.url(),
            status: response.status(),
            body: responseBody,
            headers: response.headers(),
            timestamp: new Date().toISOString()
          };

          // Parse appointment data if present
          this.appointmentApiData = this.parseAppointmentData(responseBody);
        }
      } catch (error) {
        console.error('Error capturing API response:', error.message);
      }

      // Fulfill the original response
      await route.fulfill({ response });
    });
  }

  /**
   * Parse appointment availability data from API response
   * @param {string} responseBody - The HTML or JSON response body
   * @returns {object} Parsed appointment data
   */
  parseAppointmentData(responseBody) {
    const data = {
      hasAppointments: false,
      availableDates: [],
      errorMessage: null
    };

    try {
      // Check for JSON response first
      if (responseBody.trim().startsWith('{') || responseBody.trim().startsWith('[')) {
        try {
          const json = JSON.parse(responseBody);
          // Handle JSON structure if present
          data.hasAppointments = json.hasAppointments || false;
          data.availableDates = json.availableDates || [];
          return data;
        } catch (e) {
          // Not JSON, continue with HTML parsing
        }
      }

      // DEFINITIVE INDICATOR: Check for CalendarDateModel in the response
      // This model ONLY appears when appointments are actually available
      // This is more reliable than checking for calendar HTML (which may be rendered client-side)
      const hasCalendarModel = responseBody.includes('OABSEngine.Models.CalendarDateModel');

      if (hasCalendarModel) {
        data.hasAppointments = true;

        // Extract available dates from the response
        // The dates are in YYYY-MM-DD format in the form data
        const simpleDateMatches = [...responseBody.matchAll(/(\d{4}-\d{2}-\d{2})/g)];
        for (const match of simpleDateMatches) {
          if (!data.availableDates.includes(match[1])) {
            data.availableDates.push(match[1]);
          }
        }

        return data; // Early return - we found appointments
      }

      // Only check for error if CalendarDateModel is NOT present
      // Look for the actual visible error span with the specific message
      const errorPattern = /<span[^>]*class="[^"]*field-validation-error[^"]*"[^>]*>[^<]*This office does not currently have any appointments available[^<]*<\/span>/i;
      const hasVisibleError = errorPattern.test(responseBody);

      if (hasVisibleError) {
        data.errorMessage = 'No appointments available';
        data.hasAppointments = false;
      }

    } catch (error) {
      console.error('Error parsing appointment data:', error.message);
    }

    return data;
  }

  /**
   * Navigate to the appointment page and setup geolocation
   * @param {string} url - The URL to navigate to
   * @param {object} geolocation - Object with latitude and longitude
   */
  async navigateAndSetup(url, geolocation) {
    // Setup API interception before navigation
    await this.setupApiInterception();

    // Grant permissions
    await this.page.context().grantPermissions(['geolocation'], { origin: url });
    await this.page.context().setGeolocation(geolocation);

    // Navigate with proper wait strategies
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Click the "Make Appointment" button
   */
  async clickMakeAppointment() {
    await this.makeApptButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.makeApptButton.click();
  }

  /**
   * Select appointment type by ID or text
   * @param {string} appointmentTypeId - The data-id attribute value (optional)
   * @param {string} appointmentTypeText - The text content to match (optional)
   * @throws {Error} If neither appointmentTypeId nor appointmentTypeText is provided
   */
  async selectAppointmentType(appointmentTypeId, appointmentTypeText) {
    if (!appointmentTypeId && !appointmentTypeText) {
      throw new Error('Either appointmentTypeId or appointmentTypeText must be provided');
    }

    let appointmentOption;

    if (appointmentTypeId) {
      // Select by data-id attribute
      appointmentOption = this.page.locator(`[data-id="${appointmentTypeId}"].QflowObjectItem`);
    } else {
      // Select by text content
      appointmentOption = this.page.locator('.QflowObjectItem .form-control-child', { hasText: appointmentTypeText });
    }

    await appointmentOption.waitFor({ state: 'visible', timeout: 10000 });
    await appointmentOption.click();
    await this.blockLoader.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Select Teen Driver Level 1 appointment type (legacy method for backwards compatibility)
   * @deprecated Use selectAppointmentType() instead
   */
  async selectTeenDriver() {
    await this.selectAppointmentType('10', null);
  }

  /**
   * Wait for active units (locations) to load
   * Returns true if active units are found, false otherwise
   */
  async waitForActiveUnitsLoad() {
    await this.blockLoader.waitFor({ state: 'hidden', timeout: 10000 });
    // Check if any active units are available (don't throw if not found)
    try {
      await this.activeUnits.first().waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch (error) {
      // No active units available - this is a valid state
      return false;
    }
  }

  /**
   * Get the count of active units (available locations)
   * @returns {Promise<number>} Number of active units
   */
  async getActiveUnitsCount() {
    return await this.activeUnits.count();
  }

  /**
   * Get the city name from an active unit
   * @param {number} index - The index of the active unit
   * @returns {Promise<string>} City name
   */
  async getCityName(index) {
    const unit = this.activeUnits.nth(index);
    const cityNameDiv = unit.locator('div > div:nth-child(1)');
    const cityName = await cityNameDiv.textContent();
    return cityName?.trim() || 'Unknown';
  }

  /**
   * Click on a specific active unit by index
   * @param {number} index - The index of the active unit to click
   */
  async clickActiveUnit(index) {
    // Clear previous API data
    this.lastApiResponse = null;
    this.appointmentApiData = null;

    // Wait for the API response when clicking
    const responsePromise = this.page.waitForResponse(
      response => response.url().includes('/Webapp/Appointment/AmendStep'),
      { timeout: 15000 }
    ).catch(() => null);

    const unit = this.activeUnits.nth(index);
    await unit.click();

    // Wait for the API response to be captured
    await responsePromise;

    // Check if page is still valid before waiting for elements
    if (this.page.isClosed()) {
      throw new Error('Page was closed unexpectedly after clicking unit');
    }

    // Wait for loader to hide with better error handling
    try {
      await this.blockLoader.waitFor({ state: 'hidden', timeout: 10000 });
    } catch (error) {
      // If page is closed, throw a more specific error
      if (this.page.isClosed()) {
        throw new Error('Page was closed while waiting for loader to hide');
      }
      // Re-throw if it's a different error
      throw error;
    }

    // Wait for network idle with error handling
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch (error) {
      // If page is closed, log but don't fail
      if (this.page.isClosed()) {
        console.warn('Page closed before network idle state reached');
        return;
      }
      // For other errors, just log and continue
      console.warn('Network idle wait timed out:', error.message);
    }

    // Give a small delay for the API data to be processed
    await this.page.waitForTimeout(500).catch(() => { });
  }

  /**
   * Check if appointments are available using API data (preferred) or DOM fallback
   * @returns {Promise<boolean>} True if appointments are available
   */
  async hasAppointmentsAvailable() {
    // Check if page is still valid
    if (this.page.isClosed()) {
      console.warn('Page is closed, cannot check appointment availability');
      return false;
    }

    // Wait a moment for the page to stabilize after navigation
    await this.page.waitForTimeout(500).catch(() => { });

    // PRIORITY 1: Use captured API data if available
    if (this.appointmentApiData) {
      // If hasAppointments is explicitly set, use it directly (most reliable)
      if (this.appointmentApiData.hasAppointments === true) {
        return true;
      }

      // If there's an explicit error message, no appointments
      if (this.appointmentApiData.errorMessage) {
        return false;
      }

      // If explicitly marked as no appointments
      if (this.appointmentApiData.hasAppointments === false) {
        return false;
      }
    }

    // PRIORITY 2: Fallback to DOM-based detection
    console.log('Falling back to DOM-based availability check');

    // Check page validity again before DOM operations
    if (this.page.isClosed()) {
      console.warn('Page closed during availability check');
      return false;
    }

    // First check for positive indicator - the appointment selection heading
    const hasAppointmentHeading = await this.appointmentHeading.isVisible().catch(() => false);
    if (hasAppointmentHeading) {
      return true; // If we see the appointment selector, appointments are available
    }

    // Check for error message (negative indicator)
    const errorVisible = await this.noAppointmentsError
      .filter({ hasText: 'This office does not currently have any appointments available' })
      .isVisible()
      .catch(() => false);

    if (errorVisible) {
      return false; // Explicit error message
    }

    // Check for hidden input indicating no dates (negative indicator)
    const errorInputCount = await this.errorHiddenInput.count().catch(() => 0);
    if (errorInputCount > 0) {
      return false; // Hidden error input present
    }

    // If no clear positive or negative indicators, return true (optimistic)
    return true;
  }

  /**
   * Get the last captured API response data
   * @returns {object|null} The last API response or null
   */
  getLastApiResponse() {
    return this.lastApiResponse;
  }

  /**
   * Get the parsed appointment data from the last API call
   * @returns {object|null} The parsed appointment data or null
   */
  getAppointmentApiData() {
    return this.appointmentApiData;
  }

  /**
   * Check a location for appointment availability
   * @param {number} index - The index of the location to check
   * @returns {Promise<object>} Object with cityName and isAvailable properties
   */
  async checkLocationAvailability(index) {
    // Get city name before clicking (in case navigation changes things)
    const cityName = await this.getCityName(index);

    // Click the location
    await this.clickActiveUnit(index);

    // Check availability
    const isAvailable = await this.hasAppointmentsAvailable();

    return { cityName, isAvailable };
  }

  /**
   * Navigate back to the previous page
   */
  async navigateBack() {
    // Check if page is still valid before navigating
    if (this.page.isClosed()) {
      throw new Error('Cannot navigate back - page is closed');
    }

    await this.page.goBack();

    // Wait for loader with error handling
    try {
      await this.blockLoader.waitFor({ state: 'hidden', timeout: 10000 });
    } catch (error) {
      if (this.page.isClosed()) {
        throw new Error('Page closed while navigating back');
      }
      console.warn('Loader wait failed during navigation back:', error.message);
    }

    // Wait for active units with error handling
    try {
      await this.activeUnits.first().waitFor({ state: 'visible', timeout: 10000 });
    } catch (error) {
      if (this.page.isClosed()) {
        throw new Error('Page closed while waiting for active units after navigation');
      }
      console.warn('Active units not visible after navigation back:', error.message);
      throw error; // Re-throw as this is critical
    }
  }

  /**
   * Take a screenshot with a specific filename
   * @param {string} filename - The filename for the screenshot
   */
  async takeScreenshot(filename) {
    try {
      await this.page.screenshot({
        path: `test-results/${filename}`,
        fullPage: true
      });
    } catch (error) {
      console.error(`Failed to take screenshot: ${error.message}`);
    }
  }

  /**
   * Debug method: Log API response details
   * Useful for troubleshooting API-based appointment detection
   */
  logApiResponseDetails() {
    if (!this.lastApiResponse) {
      console.log('No API response captured yet');
      return;
    }

    console.log('=== API Response Details ===');
    console.log('URL:', this.lastApiResponse.url);
    console.log('Status:', this.lastApiResponse.status);
    console.log('Timestamp:', this.lastApiResponse.timestamp);
    console.log('Content-Type:', this.lastApiResponse.headers['content-type']);
    console.log('Body Length:', this.lastApiResponse.body.length, 'characters');

    if (this.appointmentApiData) {
      console.log('\n=== Parsed Appointment Data ===');
      console.log('Has Appointments:', this.appointmentApiData.hasAppointments);
      console.log('Calendar Present:', this.appointmentApiData.calendarPresent);
      console.log('Available Dates:', this.appointmentApiData.availableDates);
      console.log('Error Message:', this.appointmentApiData.errorMessage || 'None');
    }
    console.log('=============================\n');
  }

  /**
   * Debug method: Save API response body to file
   * @param {string} filename - Filename to save the response (default: api-response.html)
   */
  async saveApiResponseToFile(filename = 'api-response.html') {
    if (!this.lastApiResponse) {
      console.log('No API response to save');
      return;
    }

    const fs = require('fs');
    const path = require('path');

    try {
      const filePath = path.join('test-results', filename);
      fs.writeFileSync(filePath, this.lastApiResponse.body, 'utf8');
      console.log(`API response saved to: ${filePath}`);
    } catch (error) {
      console.error(`Failed to save API response: ${error.message}`);
    }
  }

  /**
   * Get all available calendar dates
   * @returns {Promise<Array>} Array of available date elements
   */
  async getAvailableDates() {
    // Wait for the appointment heading to ensure we're on the right page
    const hasAppointmentSection = await this.page.waitForSelector('text=Please select date and time', { timeout: 5000 }).catch(() => false);

    if (!hasAppointmentSection) {
      console.log('Appointment selection section not visible');
      return [];
    }

    // Wait a bit for calendar to render
    await this.page.waitForTimeout(1000);

    // Try multiple selectors for available dates
    const selectors = [
      '.calendar-day.available',
      '.ui-datepicker-calendar td:not(.ui-datepicker-unselectable):not(.ui-datepicker-other-month) a',
      'td[data-handler="selectDay"] a',
      '.ui-state-default',
      '.calendar-container td.available'
    ];

    for (const selector of selectors) {
      const dates = await this.page.locator(selector).all();
      if (dates.length > 0) {
        // console.log(`Found ${dates.length} dates using selector: ${selector}`);
        return dates;
      }
    }

    console.log('No available dates found with any selector');
    return [];
  }

  /**
   * Select a calendar date by index
   * @param {number} index - Index of the date to select (default: 0 for first available)
   * @returns {Promise<boolean>} True if date was selected, false if no dates available
   */
  async selectDate(index = 0) {
    const dates = await this.getAvailableDates();

    if (dates.length === 0) {
      console.log('No dates available');
      return false;
    }

    if (index >= dates.length) {
      console.log(`Index ${index} out of range. Only ${dates.length} dates available.`);
      return false;
    }

    await dates[index].click();

    // Wait for time slots to load - check for both select dropdowns and radio inputs
    await Promise.race([
      this.page.waitForSelector('select option[data-datetime]', { timeout: 5000 }),
      this.page.waitForSelector('input[type="radio"][data-datetime]', { timeout: 5000 })
    ]).catch(() => null);

    return true;
  }

  /**
   * Get all available time slots with their datetime and value
   * @returns {Promise<Array>} Array of time slot objects with datetime and value properties
   */
  async getTimeSlots() {
    // Get time slots from select dropdown
    const timeSlots = await this.page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      const slots = [];

      selects.forEach(select => {
        const options = select.querySelectorAll('option[data-datetime]');
        options.forEach(option => {
          const datetime = option.getAttribute('data-datetime');
          // Skip empty options (the "-" placeholder)
          if (datetime && datetime.trim()) {
            slots.push({
              datetime: datetime,
              value: option.textContent.trim(),
              selectId: select.getAttribute('id'),
              serviceId: option.getAttribute('data-serviceid'),
              appointmentTypeId: option.getAttribute('data-appointmenttypeid')
            });
          }
        });
      });

      return slots;
    });

    if (timeSlots.length > 0) {
      console.log(`Found ${timeSlots.length} time slots in select dropdown`);
      return timeSlots;
    }

    // Fallback to radio inputs
    const radioTimeSlots = await this.page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="radio"][data-datetime]');

      return Array.from(inputs).map(input => ({
        datetime: input.getAttribute('data-datetime'),
        value: input.getAttribute('value'),
        id: input.getAttribute('id')
      }));
    });

    if (radioTimeSlots.length > 0) {
      console.log(`Found ${radioTimeSlots.length} time slots in radio inputs`);
      return radioTimeSlots;
    }

    console.log('No time slots found');
    return [];
  }

  /**
   * Get morning time slots (AM times with hour >= 8)
   * @returns {Promise<Array>} Array of morning time slot objects
   */
  async getMorningTimeSlots() {
    const allSlots = await this.getTimeSlots();

    return allSlots.filter(slot => {
      if (!slot.datetime) return false;
      const time = slot.datetime.split(' ')[1]; // Extract time portion
      const hour = parseInt(time.split(':')[0]);
      return slot.datetime.includes('AM') && hour >= 8;
    });
  }

  /**
   * Get afternoon time slots (PM times before 5 PM)
   * @returns {Promise<Array>} Array of afternoon time slot objects
   */
  async getAfternoonTimeSlots() {
    const allSlots = await this.getTimeSlots();

    return allSlots.filter(slot => {
      if (!slot.datetime) return false;
      const time = slot.datetime.split(' ')[1]; // Extract time portion
      const hour = parseInt(time.split(':')[0]);
      return slot.datetime.includes('PM') && hour < 5;
    });
  }

  /**
   * Select a time slot by value
   * @param {string} value - The value/text of the time slot (e.g., "8:00 AM")
   * @param {string} selectId - Optional select element ID for dropdown selection
   * @returns {Promise<boolean>} True if slot was selected successfully
   */
  async selectTimeSlot(value, selectId = null) {
    try {
      // Try select dropdown first
      if (selectId) {
        await this.page.selectOption(`#${selectId}`, { label: value });
        console.log(`Selected time slot from dropdown: ${value}`);
        return true;
      }

      // Try to find a select with the matching option
      const selected = await this.page.evaluate((timeValue) => {
        const selects = document.querySelectorAll('select');
        for (const select of selects) {
          const options = select.querySelectorAll('option');
          for (const option of options) {
            if (option.textContent.trim() === timeValue) {
              select.value = option.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          }
        }
        return false;
      }, value);

      if (selected) {
        console.log(`Selected time slot from dropdown: ${value}`);
        return true;
      }

      // Fallback to radio button
      await this.page.click(`input[type="radio"][value="${value}"]`);
      console.log(`Selected time slot radio: ${value}`);
      return true;
    } catch (error) {
      console.error(`Failed to select time slot: ${error.message}`);
      return false;
    }
  }

  /**
   * Find and select the first available morning appointment
   * @returns {Promise<object|null>} The selected time slot object or null if none available
   */
  async findAndSelectFirstMorningSlot() {
    // Select first available date
    const dateSelected = await this.selectDate(0);

    if (!dateSelected) {
      console.log('No dates available');
      return null;
    }

    // Get all morning slots
    const morningSlots = await this.getMorningTimeSlots();

    if (morningSlots.length === 0) {
      console.log('No morning slots available');
      return null;
    }

    // Select the first morning slot
    const firstSlot = morningSlots[0];
    const selected = await this.selectTimeSlot(firstSlot.value, firstSlot.selectId);

    if (selected) {
      console.log(`Selected: ${firstSlot.datetime}`);
      return firstSlot;
    }

    return null;
  }

  /**
   * Find and select the first available afternoon appointment
   * @returns {Promise<object|null>} The selected time slot object or null if none available
   */
  async findAndSelectFirstAfternoonSlot() {
    // Select first available date
    const dateSelected = await this.selectDate(0);

    if (!dateSelected) {
      console.log('No dates available');
      return null;
    }

    // Get all afternoon slots
    const afternoonSlots = await this.getAfternoonTimeSlots();

    if (afternoonSlots.length === 0) {
      console.log('No afternoon slots available');
      return null;
    }

    // Select the first afternoon slot
    const firstSlot = afternoonSlots[0];
    const selected = await this.selectTimeSlot(firstSlot.value, firstSlot.selectId);

    if (selected) {
      console.log(`Selected: ${firstSlot.datetime}`);
      return firstSlot;
    }

    return null;
  }
}

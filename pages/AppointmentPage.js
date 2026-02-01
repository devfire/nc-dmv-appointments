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
      errorMessage: null,
      calendarPresent: false
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

      // Check for calendar widget presence in HTML
      data.calendarPresent = responseBody.includes('ui-datepicker') ||
                            responseBody.includes('calendar-day') ||
                            responseBody.includes('Please select date and time');

      // Check for explicit error messages
      if (responseBody.includes('This office does not currently have any appointments available') ||
          responseBody.includes('ErrorNoAvaiableDates')) {
        data.errorMessage = 'No appointments available';
        data.hasAppointments = false;
        return data;
      }

      // If calendar is present, there are likely appointments
      if (data.calendarPresent) {
        data.hasAppointments = true;
        
        // Try to extract available dates from the HTML
        // Look for date cells that are not disabled
        const datePattern = /<td[^>]*(?!ui-datepicker-unselectable)[^>]*data-handler="selectDay"[^>]*>(\d+)<\/td>/gi;
        let match;
        while ((match = datePattern.exec(responseBody)) !== null) {
          data.availableDates.push(match[1]);
        }
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
    
    await this.blockLoader.waitFor({ state: 'hidden', timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
    
    // Give a small delay for the API data to be processed
    await this.page.waitForTimeout(500);
  }

  /**
   * Check if appointments are available using API data (preferred) or DOM fallback
   * @returns {Promise<boolean>} True if appointments are available
   */
  async hasAppointmentsAvailable() {
    // Wait a moment for the page to stabilize after navigation
    await this.page.waitForTimeout(500);
    
    // PRIORITY 1: Use captured API data if available
    if (this.appointmentApiData) {
      console.log('Using API data for availability check:', {
        hasAppointments: this.appointmentApiData.hasAppointments,
        availableDates: this.appointmentApiData.availableDates.length,
        errorMessage: this.appointmentApiData.errorMessage
      });
      
      // If there's an explicit error message, no appointments
      if (this.appointmentApiData.errorMessage) {
        return false;
      }
      
      // If calendar is present or we have available dates, appointments exist
      if (this.appointmentApiData.calendarPresent ||
          this.appointmentApiData.availableDates.length > 0) {
        return true;
      }
      
      // If explicitly marked as no appointments
      if (this.appointmentApiData.hasAppointments === false) {
        return false;
      }
    }
    
    // PRIORITY 2: Fallback to DOM-based detection
    console.log('Falling back to DOM-based availability check');
    
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
    const errorInputCount = await this.errorHiddenInput.count();
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
    await this.page.goBack();
    await this.blockLoader.waitFor({ state: 'hidden', timeout: 10000 });
    await this.activeUnits.first().waitFor({ state: 'visible', timeout: 10000 });
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
}

export class AppointmentPage {
  constructor(page) {
    this.page = page;
    // Locators
    this.makeApptButton = page.locator('button#cmdMakeAppt');
    this.blockLoader = page.locator('#BlockLoader');
    this.teenDriverOption = page.locator('[data-id="10"].QflowObjectItem');
    this.activeUnits = page.locator('.QflowObjectItem.form-control.ui-selectable.Active-Unit.valid');
    this.noAppointmentsError = page.locator('span.field-validation-error');
    this.errorHiddenInput = page.locator('input[name="StepControls[1].FieldName"][value="ErrorNoAvaiableDates"]');
  }

  /**
   * Navigate to the appointment page and setup geolocation
   * @param {string} url - The URL to navigate to
   * @param {object} geolocation - Object with latitude and longitude
   */
  async navigateAndSetup(url, geolocation) {
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
   * Select Teen Driver Level 1 appointment type
   */
  async selectTeenDriver() {
    await this.teenDriverOption.waitFor({ state: 'visible', timeout: 10000 });
    await this.teenDriverOption.click();
    await this.blockLoader.waitFor({ state: 'hidden', timeout: 10000 });
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
    const unit = this.activeUnits.nth(index);
    await unit.click();
    await this.blockLoader.waitFor({ state: 'hidden', timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if appointments are available on the current page
   * @returns {Promise<boolean>} True if appointments are available
   */
  async hasAppointmentsAvailable() {
    // Check for error message
    const errorVisible = await this.noAppointmentsError
      .filter({ hasText: 'This office does not currently have any appointments available' })
      .isVisible()
      .catch(() => false);
    
    // Check for hidden input indicating no dates
    const errorInputCount = await this.errorHiddenInput.count();
    
    // Appointments available if neither error condition exists
    return !errorVisible && errorInputCount === 0;
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
}

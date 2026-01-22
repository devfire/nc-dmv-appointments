/**
 * Test helper utilities for DMV appointment tests
 */
export class TestHelpers {
  /**
   * Retry an operation with exponential backoff
   * @param {Function} operation - The async operation to retry
   * @param {number} maxRetries - Maximum number of retry attempts
   * @param {number} delay - Initial delay in milliseconds
   * @returns {Promise<any>} Result of the operation
   */
  static async retryOperation(operation, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }
        console.log(`Retry ${i + 1}/${maxRetries} after error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }

  /**
   * Sanitize a string to be used as a filename
   * @param {string} name - The string to sanitize
   * @returns {string} Sanitized filename
   */
  static sanitizeFilename(name) {
    return name
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase()
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Format test results into a summary object
   * @param {Array<object>} results - Array of result objects with cityName and isAvailable
   * @returns {object} Summary statistics
   */
  static formatResults(results) {
    const available = results.filter(r => r.isAvailable);
    const unavailable = results.filter(r => !r.isAvailable);
    
    return {
      total: results.length,
      available: available.length,
      unavailable: unavailable.length,
      availableLocations: available.map(r => r.cityName),
      unavailableLocations: unavailable.map(r => r.cityName)
    };
  }

  /**
   * Print a formatted summary to console
   * @param {object} summary - Summary object from formatResults
   */
  static printSummary(summary) {
    console.log('\n' + '='.repeat(40));
    console.log('SUMMARY');
    console.log('='.repeat(40));
    console.log(`Total locations checked: ${summary.total}`);
    console.log(`Locations with appointments: ${summary.available}`);
    console.log(`Locations without appointments: ${summary.unavailable}`);
    
    if (summary.available > 0) {
      console.log('\n✓ Locations with availability:');
      summary.availableLocations.forEach(loc => console.log(`  • ${loc}`));
    } else {
      console.log('\n✗ No locations with availability found');
    }
    console.log('='.repeat(40) + '\n');
  }

  /**
   * Get current timestamp for logging
   * @returns {string} Formatted timestamp
   */
  static getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Log with timestamp
   * @param {string} message - Message to log
   */
  static logWithTimestamp(message) {
    console.log(`[${this.getTimestamp()}] ${message}`);
  }
}

# API-Based Appointment Detection

## Overview

The NC DMV appointment checker now uses API response interception instead of HTML DOM parsing for detecting appointment availability. This makes the system more reliable and works better with Single Page Applications (SPAs) that use dynamic calendar widgets.

## Problem Statement

The DMV website uses AJAX calls to load the calendar widget dynamically. When clicking on a location, it makes a POST request to `/Webapp/Appointment/AmendStep` which returns HTML containing the calendar widget. Parsing this HTML from the DOM was unreliable because:

1. **SPA rendering issues** - The calendar widget is loaded dynamically and may not be immediately available in the DOM
2. **Timing problems** - Race conditions between page load and DOM queries
3. **Flaky tests** - DOM-based detection was inconsistent

## Solution

The new implementation intercepts API responses at the network level using Playwright's route interception, capturing and parsing the response before it reaches the browser.

## Architecture

### 1. API Interception Setup

In [`AppointmentPage.js`](pages/AppointmentPage.js:21), the `setupApiInterception()` method is called during navigation:

```javascript
async setupApiInterception() {
  await this.page.route('**/Webapp/Appointment/AmendStep*', async (route, request) => {
    const response = await route.fetch();
    const responseBody = await response.text();
    
    // Store response for analysis
    this.lastApiResponse = { url, status, body, headers, timestamp };
    
    // Parse appointment data
    this.appointmentApiData = this.parseAppointmentData(responseBody);
    
    await route.fulfill({ response });
  });
}
```

### 2. Response Parsing

The [`parseAppointmentData()`](pages/AppointmentPage.js:59) method extracts appointment information:

```javascript
parseAppointmentData(responseBody) {
  return {
    hasAppointments: boolean,
    availableDates: array,
    errorMessage: string|null,
    calendarPresent: boolean
  };
}
```

**Detection Logic:**
- Checks for calendar widget HTML elements (`ui-datepicker`, `calendar-day`)
- Looks for error messages ("This office does not currently have any appointments available")
- Extracts available date cells using regex patterns
- Supports both JSON and HTML responses

### 3. Enhanced Availability Check

The [`hasAppointmentsAvailable()`](pages/AppointmentPage.js:242) method now uses a two-tier approach:

**Priority 1: API Data (Preferred)**
- Uses intercepted API response data if available
- Checks for error messages, calendar presence, and available dates
- More reliable and faster

**Priority 2: DOM Fallback**
- Falls back to traditional DOM parsing if API data unavailable
- Maintains backward compatibility
- Logs when fallback is used

### 4. API Call Coordination

The [`clickActiveUnit()`](pages/AppointmentPage.js:214) method now:
1. Clears previous API data
2. Waits for the API response using `page.waitForResponse()`
3. Ensures API data is captured before checking availability
4. Adds a small delay for processing

## Usage

### Basic Usage

The API interception is automatic and requires no changes to test code:

```javascript
// Setup (API interception starts automatically)
await appointmentPage.navigateAndSetup(url, geolocation);

// Select appointment type and location
await appointmentPage.clickMakeAppointment();
await appointmentPage.selectAppointmentType('10');
await appointmentPage.clickActiveUnit(0);

// Check availability (uses API data automatically)
const isAvailable = await appointmentPage.hasAppointmentsAvailable();
```

### Debug Methods

#### View API Response Details

```javascript
// After clicking a location
await appointmentPage.clickActiveUnit(0);

// Log API response details to console
appointmentPage.logApiResponseDetails();
```

**Output:**
```
=== API Response Details ===
URL: https://skiptheline.ncdot.gov/Webapp/Appointment/AmendStep?...
Status: 200
Timestamp: 2026-01-31T21:49:56.988Z
Content-Type: text/html; charset=utf-8
Body Length: 45823 characters

=== Parsed Appointment Data ===
Has Appointments: true
Calendar Present: true
Available Dates: ['5', '12', '19', '26']
Error Message: None
=============================
```

#### Save API Response to File

```javascript
// Save the HTML response for inspection
await appointmentPage.saveApiResponseToFile('location-response.html');
// Saves to: test-results/location-response.html
```

#### Access Raw API Data

```javascript
// Get the raw API response object
const response = appointmentPage.getLastApiResponse();
console.log(response.url, response.status, response.body);

// Get parsed appointment data
const data = appointmentPage.getAppointmentApiData();
console.log(data.hasAppointments, data.availableDates);
```

## API Request Details

### Endpoint Pattern

```
POST /Webapp/Appointment/AmendStep
```

**Query Parameters:**
- `stepControlTriggerId` - GUID identifying the trigger control
- `targetStepControlId` - GUID identifying the target step

### Request Headers

```
Accept: text/html, */*; q=0.01
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
X-Requested-With: XMLHttpRequest
```

### Response Format

The endpoint returns HTML containing:
- Calendar widget markup (jQuery UI Datepicker)
- Available date cells with `data-handler="selectDay"`
- Disabled dates with class `ui-datepicker-unselectable`
- Error messages if no appointments available

## Benefits

1. **Reliability** - Captures data before browser rendering issues
2. **Performance** - No need to wait for DOM updates
3. **Debugging** - Can inspect raw API responses
4. **Flexibility** - Supports both JSON and HTML responses
5. **Backward Compatible** - Falls back to DOM parsing if needed

## Troubleshooting

### API Data Not Being Captured

Check if interception is set up:
```javascript
appointmentPage.logApiResponseDetails();
// Should show "No API response captured yet" if not working
```

### Calendar Widget Not Detected

Save and inspect the raw response:
```javascript
await appointmentPage.saveApiResponseToFile('debug-response.html');
// Check the HTML file for calendar elements
```

### Fallback to DOM Detection

If you see "Falling back to DOM-based availability check" in logs:
- The API interception may not be catching the request
- Check the URL pattern in `setupApiInterception()`
- Verify the request is being made

## Migration Notes

Existing tests continue to work without modification. The API-based approach is transparent to test code. However, you can now:

1. **Add debugging** - Use `logApiResponseDetails()` to troubleshoot
2. **Inspect responses** - Save API responses for manual review
3. **Access raw data** - Use getter methods for advanced analysis

## Future Enhancements

Potential improvements:
- Parse time slots from API responses
- Extract appointment metadata (duration, type, etc.)
- Cache API responses for faster retries
- Support WebSocket-based real-time updates
- Add metrics for API response times

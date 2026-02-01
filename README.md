# NC DMV Appointment Checker

Automated Playwright tests to check NC DMV appointment availability across multiple locations for any appointment type.

## Purpose

Automates checking appointment availability at all NC DMV locations, saving time and effort finding available slots.

## Features

- **API-Based Detection** - Intercepts API responses for reliable appointment detection (works with dynamic calendar widgets)
- **Multi-Location Scanning** - Checks all available DMV locations in a single run
- **Detailed Results** - Shows available dates and time slots for each location
- **Screenshot Capture** - Automatically captures screenshots when appointments are found
- **Summary Reports** - Provides formatted summary of availability across all locations

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

## Setup

```bash
# Clone and install
git clone <repository-url>
cd nc-dmv-appointments
npm install

# Install Playwright browsers
npx playwright install chromium

# Configure environment (optional)
cp .env.example .env
```

## Configuration

Copy `.env.example` to `.env` and customize:

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | DMV appointment URL | NC DMV default URL |
| `LATITUDE` / `LONGITUDE` | Your location | Raleigh, NC |
| `APPOINTMENT_TYPE_ID` | Appointment type ID (preferred) | `10` |
| `APPOINTMENT_TYPE_TEXT` | Appointment type text (fallback) | - |
| `HEADLESS` | Run without browser UI | `true` |
| `SLOW_MO` | Slow down test execution | `0` |

### Finding Appointment Type ID

1. Right-click on the appointment type you need on the DMV site
2. Select "Inspect"
3. Look for `data-id` attribute on the element (one line above the inspected element)

## Usage

```bash
# Run tests
npm test              # Headless mode
npm run test:headed   # With browser visible
npm run test:debug    # Debug mode with inspector
npm run test:ui       # Interactive UI mode

# View HTML report
npm run report
```

## Output

The test provides:
- Real-time status for each location checked
- Available dates when appointments are found
- Time slots for the first available date
- Screenshots saved to `test-results/` for locations with availability
- Summary report at the end

## Technical Details

See [`API_APPROACH.md`](API_APPROACH.md) for details on the API interception implementation and debugging methods.

## Disclaimer

This tool is for personal use only. Please respect the NC DMV website's terms of service and avoid excessive automated requests.

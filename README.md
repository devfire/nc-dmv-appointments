# NC DMV Appointment Checker

Automated Playwright tests to check NC DMV appointment availability across multiple locations for any appointment type.

## Purpose

This tool automates the process of checking appointment availability at all NC DMV locations, saving time and effort in finding available appointment slots. Because what's happening now is a pure travesty.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

## Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd nc-dmv-appointments
```

2. **Install dependencies**
```bash
npm install
```

3. **Install Playwright browsers**
```bash
npx playwright install chromium
```

4. **Configure environment (optional)**
```bash
cp .env.example .env
# Edit .env with your preferred settings
```

## Configuration

Copy `.env.example` to `.env` and customize:

**Appointment Type** (choose one method):
- `APPOINTMENT_TYPE_ID=10` - Use `data-id` attribute (preferred)
- `APPOINTMENT_TYPE_TEXT=Limited provisional license - ages 16-17; Level 1 permit` - Use exact text

**Other Options**:
- `BASE_URL` - DMV appointment URL
- `LATITUDE` / `LONGITUDE` - Your location (defaults to Raleigh, NC)
- `HEADLESS=true` / `SLOW_MO=0` - Test execution options

To find appointment type: Inspect element on DMV site → look for `data-id` or text in `<div class="form-control-child">`.

## Usage

### Run Tests

```bash
# Run tests in headless mode
npm test

# Run tests with browser visible
npm run test:headed

# Debug mode with Playwright Inspector
npm run test:debug

# Interactive UI mode
npm run test:ui
```

### View Reports

```bash
# Open HTML report after test run
npm run report
```

## Disclaimer

This tool is for personal use only. Please respect the NC DMV website's terms of service and avoid excessive automated requests.

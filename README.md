# NC DMV Appointment Checker

Automated Playwright tests to check NC DMV appointment availability across multiple locations for Teen Driver Level 1 appointments.

## 🎯 Purpose

This tool automates the process of checking appointment availability at all NC DMV locations, saving time and effort in finding available appointment slots.

## 📋 Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

## 🚀 Setup

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

## 🎮 Usage

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

## 📁 Project Structure

```
nc-dmv-appointments/
├── tests/                      # Test files
│   └── dmv-appointments.spec.js
├── pages/                      # Page Object Model classes
│   └── AppointmentPage.js
├── utils/                      # Helper utilities
│   └── test-helpers.js
├── test-results/              # Test artifacts (screenshots, videos)
├── playwright-report/         # HTML test reports
├── playwright.config.js       # Playwright configuration
├── package.json              # Project dependencies
├── .env.example              # Environment template
└── README.md                 # This file
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

- `BASE_URL`: NC DMV appointment URL (default provided)
- `LATITUDE`: Geolocation latitude (default: Raleigh, NC)
- `LONGITUDE`: Geolocation longitude (default: Raleigh, NC)

### Playwright Configuration

Edit `playwright.config.js` to customize:
- Test timeout
- Retry strategy
- Browser options
- Screenshot/video settings
- Reporter configuration

## 📊 Test Output

The test will:
1. Navigate to the NC DMV appointment website
2. Select "Teen Driver Level 1" appointment type
3. Check all available locations
4. Report which locations have appointments
5. Take screenshots of locations with availability
6. Generate a summary report

### Console Output Example
```
Found 25 locations to check for appointments
Raleigh: Nothing available
Durham: Appointments available ✓
Chapel Hill: Nothing available
...

=== SUMMARY ===
Total locations checked: 25
Locations with appointments: 2
Locations without appointments: 23

Locations with availability:
  - Durham
  - Greensboro
```

## 🐛 Troubleshooting

### Tests are flaky
- Check network stability
- Increase timeouts in `playwright.config.js`
- Review recent DMV website changes

### Screenshots not capturing
- Ensure `test-results/` directory exists
- Check disk space
- Verify write permissions

### Browser won't start
```bash
# Reinstall browsers
npx playwright install --force chromium
```

## 📈 Best Practices Implemented

✅ Page Object Model for maintainability  
✅ Auto-waiting instead of hard-coded timeouts  
✅ Retry logic for stability  
✅ Comprehensive error handling  
✅ Screenshot capture on availability  
✅ HTML reports with trace viewer  
✅ CI/CD ready configuration  

## 🔗 Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [NC DMV Skip The Line](https://skiptheline.ncdot.gov)

## 📝 License

ISC

## 🤝 Contributing

Contributions welcome! Please read `PLAYWRIGHT_IMPROVEMENTS.md` for detailed improvement recommendations.

## ⚠️ Disclaimer

This tool is for personal use only. Please respect the NC DMV website's terms of service and avoid excessive automated requests.

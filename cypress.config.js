const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    specPattern: 'cypress/e2e/**/*.{js,jsx}',
    supportFile: false,
    video: false,
    screenshotOnRunFailure: false,
    experimentalWebKitSupport: true
  },
  env: {
    tsConfig: 'cypress.tsconfig.json'
  }
}) 
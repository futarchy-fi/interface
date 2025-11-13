describe('Company Search', () => {
  beforeEach(() => {
    cy.visit('/company')
  })

  it('should find and display the Gnosis card', () => {
    // Just check if the Gnosis card exists and is visible
    cy.get('[data-testid="company-card-title-gnosis"]')
      .should('be.visible')
      .and('contain.text', 'Gnosis')
  })

  it('should navigate to milestones page, show correct proposal, and open market view', () => {
    // Find and click the Gnosis card
    cy.get('[data-testid="company-card-title-gnosis"]')
      .click()

    // Verify URL has changed to the milestones page
    cy.url().should('include', '/milestones?company_id=9')

    // Wait for the API response to complete
    cy.intercept('GET', 'https://stag.api.tickspread.com/v4/company_info*').as('companyInfo')
    cy.wait('@companyInfo')

    // Find the specific proposal and click View Market
    cy.contains('What will be the impact on GNO price if GnosisPay reaches $5mil weekly volume?')
      .should('be.visible')
      .parents('.flex.flex-col')
      .find('a')
      .contains('View Market')
      .click()

    // Verify navigation to markets page
    cy.url().should('include', '/markets')
    cy.url().should('include', 'proposalId=')

    // Check wallet connection status
    cy.get('header').then($header => {
      const isWalletConnected = !$header.find('button:contains("Connect Wallet")').length;
      
      // If wallet is not connected, verify balance shows dashes
      if (!isWalletConnected) {
        // Check SDAI balance
        cy.contains('SDAI')
          .parent()
          .find('.text-base.font-medium')
          .should('contain', '-')
        
        // Check GNO balance
        cy.contains('GNO')
          .parent()
          .find('.text-base.font-medium')
          .should('contain', '-')
          
        // Check wallet balances
        cy.contains('Wallet:')
          .parent()
          .should('contain', '-')
      }

      // Check input placeholder
      cy.get('input[placeholder="Enter Amount"]')
        .should('have.attr', 'placeholder', 'Enter Amount')
        .and('have.value', '')
    })

    // Wait for market data API response
    cy.intercept('GET', '**/api/market-data*').as('marketData')
    cy.wait('@marketData')

    // Check that price values are loaded and not showing errors
    cy.contains('SPOT PRICE')
      .parent()
      .find('span')
      .invoke('text')
      .should('not.include', 'Error')
      .and('match', /\d+/)

    cy.contains('YES PRICE')
      .parent()
      .find('span')
      .invoke('text')
      .should('not.include', 'Error')
      .and('match', /\d+/)

    cy.contains('NO PRICE')
      .parent()
      .find('span')
      .invoke('text')
      .should('not.include', 'Error')
      .and('match', /\d+/)
  })
}) 
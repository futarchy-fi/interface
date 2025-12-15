import React from 'react';
import SellPassModal from './SellPassModal';

export default {
  title: 'FutarchyFi/Market/SellPassModal',
  component: SellPassModal,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="bg-futarchyGray3 p-8 min-h-screen flex items-center justify-center">
        <Story />
      </div>
    ),
  ],
};

const Template = (args) => <SellPassModal {...args} />;

// Initial state
export const Default = Template.bind({});
Default.args = {
  title: 'Sell Pass',
  supportText: 'Enter the amount of passes you want to sell.',
  alertContainerTitle: 'Transaction Information',
  alertSupportText: 'Make sure to review the amount before confirming the transaction.',
  handleClose: () => console.log('Close clicked'),
  handleSellPass: (amount) => console.log('Sell pass:', amount),
  connectedWalletAddress: '0x1234...5678',
  balances: {
    companyYes: '100.00'
  }
};

// Processing state - Step 1
export const ProcessingStep1 = Template.bind({});
ProcessingStep1.args = {
  ...Default.args,
  processingStep: 1,
  isSimulating: true
};

// Processing state - Step 2
export const ProcessingStep2 = Template.bind({});
ProcessingStep2.args = {
  ...Default.args,
  processingStep: 2,
  isSimulating: true
};

// Processing state - Step 3
export const ProcessingStep3 = Template.bind({});
ProcessingStep3.args = {
  ...Default.args,
  processingStep: 3,
  isSimulating: true
};

// Processing state - All Steps
export const ProcessingAllSteps = Template.bind({});
ProcessingAllSteps.args = {
  ...Default.args,
  processingStep: 1,
  isSimulating: true
};

ProcessingAllSteps.play = async ({ canvasElement }) => {
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Get the component instance
  const modal = canvasElement.querySelector('.bg-white');
  if (!modal) return;

  // Simulate the full process
  const steps = [1, 2, 3];
  
  for (const step of steps) {
    // Update the processing step
    const component = modal.closest('[data-story-id]').__storybook_preview_iframe__;
    component.contentWindow.__STORYBOOK_STORY_STORE__.store?.setState(state => ({
      ...state,
      args: {
        ...state.args,
        processingStep: step
      }
    }));

    // Show details for the current step
    const showDetailsButton = modal.querySelector(`button.text-futarchyLavender`);
    if (showDetailsButton) {
      showDetailsButton.click();
    }

    // Wait for substeps to complete
    await sleep(4000); // Wait enough time for substeps to complete
  }
}; 
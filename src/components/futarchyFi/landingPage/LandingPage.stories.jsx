// SwapPage.stories.jsx
import React from 'react';
import SwapPage from './LandingPage'; // Adjust the import path as necessary

export default {
  title: 'Futarchy Fi/Landing Page/Landing Page',
  component: SwapPage,
  parameters: {
    layout: 'fullscreen', // Ensures it takes up the entire viewport
  },
};

const Template = (args) => <SwapPage {...args} />;

export const Default = {
  args: {
    useStorybookUrl: true
  }
};

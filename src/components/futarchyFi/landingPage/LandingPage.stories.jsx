// LandingPage.stories.jsx
import React from 'react';
import LandingPage from './LandingPage';

export default {
  title: 'Futarchy Fi/Landing Page/Landing Page',
  component: LandingPage,
  parameters: {
    layout: 'fullscreen',
  },
};

const Template = (args) => <LandingPage {...args} />;

export const Default = {
  args: {
    useStorybookUrl: true
  }
};

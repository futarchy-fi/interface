// src/stories/ProposalsPage.stories.jsx
import React from "react";
import ProposalsPage from "./ProposalsPage";

export default {
  title: 'Futarchy Fi/Proposals/ProposalsPage',
  component: ProposalsPage,
  parameters: {
    layout: 'fullscreen',
  },
};

export const FutarchyFi = {
  args: {
    initialCompanyId: 'futarchyfi',
    useStorybookUrl: true
  }
};

export const GnosisDAO = {
  args: {
    initialCompanyId: 'gnosis',
    useStorybookUrl: true
  }
};

export const SkyMavis = {
  args: {
    initialCompanyId: 'skymavis',
    useStorybookUrl: true
  }
};

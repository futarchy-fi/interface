import React, { useState, useEffect } from "react";
import { EventsCard, MobileEventsCard } from "../../cards/EventsCard";
import { RootLayout } from "../../layouts/RootLayout";

const EventsPage = ({ initialCompanyId = 'futarchyfi', useStorybookUrl = false }) => {
  return (
    <RootLayout headerConfig="proposals" footerConfig="main">
      {/* Similar structure to ProposalsPage */}
    </RootLayout>
  );
};

export default EventsPage; 
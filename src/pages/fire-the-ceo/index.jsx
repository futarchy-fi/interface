import React from 'react';
import RootLayout from '@components/layout/RootLayout';
import FireTheCeoPageContent from '@components/futarchyFi/fireTheCeo/FireTheCeoPageContent';

const FireTheCeoPage = () => {
  return (
    <RootLayout headerConfig="proposals" footerConfig="main">
      <FireTheCeoPageContent />
    </RootLayout>
  );
};

export default FireTheCeoPage; 
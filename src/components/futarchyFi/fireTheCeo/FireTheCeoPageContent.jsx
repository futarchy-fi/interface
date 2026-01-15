import React from 'react';
import FireTheCeoBanner from './FireTheCeoBanner';
import FireTheCeoCard from './FireTheCeoCard';

// Mock data for the cards
const placeholderCompanyLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='%23e0e0e0'/%3E%3C/svg%3E";
const placeholderCeoImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23e0e0e0'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

const mockCards = [
  { id: 1, title: 'Impact if Tim Cook is fired from Apple', impact: '+15.2%', companyLogo: placeholderCompanyLogo, ceoImage: placeholderCeoImage },
  { id: 2, title: 'Impact if Elon Musk is replaced at Tesla', impact: '-8.5%', companyLogo: placeholderCompanyLogo, ceoImage: placeholderCeoImage },
  { id: 3, title: 'Impact if Satya Nadella leaves Microsoft', impact: '+3.1%', companyLogo: placeholderCompanyLogo, ceoImage: placeholderCeoImage },
  { id: 4, title: 'Impact if Sundar Pichai exits Alphabet', impact: '+1.8%', companyLogo: placeholderCompanyLogo, ceoImage: placeholderCeoImage },
  { id: 5, title: 'Impact if Mark Zuckerberg steps down from Meta', impact: '+22.7%', companyLogo: placeholderCompanyLogo, ceoImage: placeholderCeoImage },
  { id: 6, title: 'Impact if Jeff Bezos returns to Amazon CEO', impact: '-5.0%', companyLogo: placeholderCompanyLogo, ceoImage: placeholderCeoImage },
  // Add more mock cards as needed
];

const FireTheCeoPageContent = () => {
  return (
    <div className="min-h-screen w-full flex flex-col select-none bg-white dark:bg-futarchyDarkGray2">
      <FireTheCeoBanner />

      {/* Cards Grid Section */}
      <div className="container mx-auto px-5 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockCards.map((card) => (
            <FireTheCeoCard key={card.id} {...card} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FireTheCeoPageContent; 
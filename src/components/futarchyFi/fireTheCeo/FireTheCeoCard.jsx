import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

const FireTheCeoCard = ({ title, impact, companyLogo, ceoImage }) => {
  const isPositiveImpact = impact.startsWith('+');
  const impactColor = isPositiveImpact ? 'text-futarchyTeal7' : 'text-futarchyCrimson7';

  // Placeholder link - replace with actual market link logic
  const marketLink = `/market?proposal=${encodeURIComponent(title)}`;

  return (
    <div className="bg-futarchyGray2 dark:bg-futarchyDarkGray3 rounded-xl border-2 border-futarchyGray62 dark:border-futarchyDarkGray42 overflow-hidden transition-shadow hover:shadow-lg flex flex-col">
      {/* Card Header with Images */}
      <div className="relative h-32 bg-gradient-to-b from-futarchyGray3 to-futarchyGray2 dark:from-futarchyDarkGray4 dark:to-futarchyDarkGray3 p-4 flex items-center justify-between">
        {/* Company Logo */}
        <div className="absolute top-4 left-4 w-10 h-10 bg-white rounded-full flex items-center justify-center border border-futarchyGray6">
          {companyLogo && <Image src={companyLogo} alt="Company Logo" width={24} height={24} className="object-contain" />}
        </div>
        {/* CEO Image */}
        <div className="absolute bottom-0 right-4 translate-y-1/3 w-16 h-16 rounded-full overflow-hidden border-4 border-white dark:border-futarchyDarkGray3 shadow-md">
          {ceoImage && <Image src={ceoImage} alt="CEO Image" layout="fill" objectFit="cover" />}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="text-base font-semibold text-futarchyGray12 dark:text-white mb-3 min-h-[48px]">
          {title}
        </h3>

        <div className="flex items-center justify-between mt-auto pt-3">
          <div>
            <span className="text-xs text-futarchyGray11 dark:text-futarchyGray112 block mb-1">Predicted Impact</span>
            <span className={`text-xl font-semibold ${impactColor}`}>{impact}</span>
          </div>
          <Link href={marketLink} legacyBehavior>
            <a className="py-2 px-4 rounded-lg text-sm font-medium transition-colors bg-black dark:bg-white hover:bg-black/90 dark:hover:bg-white/90 text-white dark:text-black">
              View Market
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FireTheCeoCard; 
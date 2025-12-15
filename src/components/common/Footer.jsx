// components/common/Footer.jsx
import Image from "next/image";

const Footer = ({ config = 'main', className = '' }) => {
  // Footer configurations
  const footerConfigs = {
    main: {
      mainSection: (
        <div className="bg-futarchyDarkGray1 text-white py-8 w-full h-full flex flex-col justify-center">
          <div className="container mx-auto px-5 flex flex-col space-y-6">
            {/* Main Content Wrapper */}
            <div className="flex flex-col md:flex-row md:gap-[100px] space-y-8 md:space-y-0">
              {/* Left Section - Logo and Tagline */}
              <div>
                <Image
                  src="/assets/futarchy-fi-logo-text-white.svg"
                  alt="Futarchy Logo"
                  width={128}
                  height={22}
                  priority
                />
                <div className="text-sm text-gray-400 mt-6 text-futarchyGray112">
                  Superintelligent board of directors<br />as a service
                </div>
              </div>

              {/* Navigation Links Section */}
              <div className="flex flex-col md:flex-row gap-8 md:gap-[52px]">
                {/* Learn More Section */}
                <div className="flex flex-col gap-3">
                  <div className="text-sm text-futarchyGray10 font-medium">Learn More</div>
                  <div className="flex flex-col gap-2">
                    <a 
                      href="https://www.notion.so/ksan/The-FAO-16b078091711801f918aeedf5d498bbc" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-sm text-futarchyGray112 hover:text-futarchyGray112/70"
                    >
                      Documentation
                    </a>
                    <a href="#" className="text-sm text-futarchyGray112 hover:text-futarchyGray112/70 hidden">
                      Careers
                    </a>
                  </div>
                </div>

                {/* Navigate Section */}
                <div className="flex flex-col gap-3">
                  <div className="text-sm text-futarchyGray10 font-medium">Navigate</div>
                  <a href="/" className="text-sm text-futarchyGray112 hover:text-futarchyGray112/70">
                    Home
                  </a>
                </div>
              </div>

              {/* Contact Section - Now at the extreme right */}
              <div className="flex flex-col gap-3 md:ml-auto hidden">
                <div className="text-sm text-futarchyGray10 font-medium">Contact</div>
                <div className="flex flex-col gap-2">
                  <a href="mailto:info@futarchy.com" className="text-sm text-futarchyGray112 hover:text-futarchyGray112/70">
                    info@futarchy.com
                  </a>
                  <a href="tel:+555000-0000" className="text-sm text-futarchyGray112 hover:text-futarchyGray112/70">
                    +555 000-0000
                  </a>
                </div>
              </div>
            </div>

            {/* Social Media Section */}
            <div className="flex flex-col space-y-2">
              <div className="text-sm text-gray-400">Social Media</div>
              <div className="flex flex-row gap-[10px]">
                {[
                  { src: '/assets/x-logo.png', alt: 'X (formerly Twitter)', href: 'https://x.com/_futarchy' }
                ].map((social, index) => (
                  <a
                    key={index}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-lg border border-futarchyGray6 flex items-center justify-center"
                  >
                    <Image
                      src={social.src}
                      alt={social.alt}
                      width={24}
                      height={24}
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    },
    landing: {
      bottomSection: (
        <div className="bg-futarchyDarkGray2 w-full border-t-2 border-futarchyDarkGray42">
          <div className="px-5 md:px-[100px] flex justify-start items-center h-[54px]">
            <div className="text-xs text-futarchyGray122">
              © 2025 FutarchyFi. All rights reserved.
            </div>
          </div>
        </div>
      )
    }
  };

  const currentConfig = footerConfigs[config];

  return (
    <footer className={`w-full mt-auto ${className}`}>
      {currentConfig.mainSection}
    </footer>
  );
};

export default Footer;

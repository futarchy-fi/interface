import React, { useRef, useEffect } from 'react';

const RulesModal = ({ isOpen, onClose }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div 
        ref={modalRef}
        className="bg-white rounded-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-2xl font-semibold">Market Rules</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            dangerouslySetInnerHTML={{ __html: '&times;' }}
          />
        </div>
        
        <div className="p-6 grid grid-cols-2 gap-6">
          {/* Voting Rules Card */}
          <div className="bg-[#F0F0FF] rounded-2xl p-6">
            <h3 className="text-xl font-semibold mb-4">Voting Rules</h3>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start gap-3">
                <div className="h-2 w-2 bg-futarchyPurple rounded-full mt-2" />
                <span>60% majority required for proposal to pass</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-2 w-2 bg-futarchyPurple rounded-full mt-2" />
                <span>Market prices determine final outcome</span>
              </li>
            </ul>
          </div>

          {/* Trading Rules Card */}
          <div className="bg-[#E6FFF9] rounded-2xl p-6">
            <h3 className="text-xl font-semibold mb-4">Trading Rules</h3>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start gap-3">
                <div className="h-2 w-2 bg-futarchyBlue rounded-full mt-2" />
                <span>Trading fees: 0% to 0.1% based on volume</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-2 w-2 bg-futarchyBlue rounded-full mt-2" />
                <span>Market prices determine final outcome</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RulesModal; 
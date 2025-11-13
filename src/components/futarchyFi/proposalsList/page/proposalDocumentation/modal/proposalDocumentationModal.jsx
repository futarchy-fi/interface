import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CloseModalButton from '../modalComponents/closeButton/CloseModalButton';
import ModalMultistep from '../modalComponents/modalMultistep/ModalMultistep';

const ProposalDocumentationModal = ({ showModal, onClose, title = 'Proposal Documentation', children }) => {
  // Add state to track if this is a fresh open
  const [isFreshOpen, setIsFreshOpen] = useState(true);

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.3 } },
  };

  const modalVariants = {
    hidden: { y: "-50px", opacity: 0 },
    visible: { y: "0", opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { y: "50px", opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
  };

  // Effect to handle cleanup when modal closes
  useEffect(() => {
    if (!showModal) {
      // When modal closes, set isFreshOpen to true for next open
      setIsFreshOpen(true);
      return;
    }

    // Cleanup function that runs when modal is about to close
    return () => {
      // This will run when the component unmounts or when showModal becomes false
      setIsFreshOpen(true);
    };
  }, [showModal]);

  const handleClose = () => {
    // Call the parent's onClose
    onClose();
  };

  return (
    <AnimatePresence onExitComplete={() => {
      // This ensures cleanup happens after the exit animation completes
      handleClose();
    }}>
      {showModal && (
        <motion.div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div
            className="bg-white dark:bg-futarchyDarkGray3 rounded-xl shadow-xl max-w-4xl w-full overflow-hidden border-2 border-futarchyGray62 dark:border-futarchyDarkGray42"
            variants={modalVariants}
            onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking inside
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 md:p-6 border-b-2 border-futarchyGray62 dark:border-futarchyDarkGray42">
              <h2 className="text-xl font-semibold text-futarchyGray12 dark:text-futarchyGray3">
                {title}
              </h2>
              <CloseModalButton onClick={handleClose} type="icon" />
            </div>

            {/* Modal Body */}
            <div className="p-0 max-h-[85vh] overflow-y-auto">
              <ModalMultistep 
                key={showModal ? 'open' : 'closed'} 
                initialData={isFreshOpen ? null : undefined}
                onCompleteAllSteps={() => {
                  setIsFreshOpen(false);
                  handleClose();
                }}
              />
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end p-4 md:p-6 border-t-2 border-futarchyGray62 dark:border-futarchyDarkGray42">
              <CloseModalButton onClick={handleClose} type="text" text="Close" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProposalDocumentationModal;

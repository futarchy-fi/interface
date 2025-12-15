import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const RedirectConfirmationModal = ({ showModal, onClose, onAccept, title = 'Confirm Redirect' }) => {
  const [countdown, setCountdown] = useState(4);
  const timerRef = useRef(null);
  const hasAcceptedRef = useRef(false);

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

  useEffect(() => {
    if (showModal) {
      setCountdown(4);
      hasAcceptedRef.current = false;
      timerRef.current = setInterval(() => {
        setCountdown(prevCountdown => prevCountdown - 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [showModal]);

  useEffect(() => {
    if (countdown === 0 && !hasAcceptedRef.current) {
      clearInterval(timerRef.current);
      hasAcceptedRef.current = true;
      onAccept();
    }
  }, [countdown, onAccept]);

  const handleClose = () => {
    clearInterval(timerRef.current);
    onClose();
  };

  return (
    <AnimatePresence>
      {showModal && (
        <motion.div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={handleClose}
        >
          <motion.div
            className="bg-white dark:bg-futarchyDarkGray3 rounded-xl shadow-xl max-w-md w-full overflow-hidden border-2 border-futarchyGray62 dark:border-futarchyDarkGray42"
            variants={modalVariants}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 md:p-6 border-b-2 border-futarchyGray62 dark:border-futarchyDarkGray42">
              <h2 className="text-xl font-semibold text-futarchyGray12 dark:text-futarchyGray3">
                {title}
              </h2>
              <button 
                onClick={handleClose}
                className="text-futarchyGray11 hover:text-futarchyGray12 dark:text-futarchyGray112 dark:hover:text-futarchyGray3 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 md:p-6 text-futarchyGray12 dark:text-futarchyGray3">
              <p>You will be redirected to a page to redeem your conditional tokens in {countdown} second{countdown === 1 ? '' : 's'}.</p>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end p-4 md:p-6 border-t-2 border-futarchyGray62 dark:border-futarchyDarkGray42">
              {/* Buttons removed as per new requirements */}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RedirectConfirmationModal; 
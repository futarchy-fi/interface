import React, { useEffect, useState } from "react";

// Modal explaining conditional markets, shown only on first visit
export default function ConditionalMarketIntroModal({ open, onClose }) {
  // Handle escape key and scroll lock
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      onClose();
    }, 6000);
    return () => clearTimeout(timer);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/90 backdrop-blur-[2px] transition-opacity duration-300" />
      {/* Modal container with scrollable area */}
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Modal */}
        <div className="relative bg-white dark:bg-black text-black dark:text-white rounded-2xl shadow-2xl border-2 border-black dark:border-white max-w-lg w-full p-10 animate-fadeInScale my-8">
        <h2 className="text-3xl font-extrabold mb-4 text-center tracking-tight font-sans">Company Milestones</h2>
        <p className="mb-8 text-gray-700 dark:text-gray-300 text-center">How Outcomes are Resolved.</p>
        <ol className="space-y-5">
          <li className="bg-white dark:bg-black rounded-lg p-5 border-2 border-black dark:border-white">
            <div className="flex items-start">
              <span className="font-bold text-lg mr-4">1</span>
              <span>
                In the company milestone markets, <span className="font-semibold text-black dark:text-white">trading activity determines if and how much a milestone increases a company's token price</span> – your trades help decide what actually happens.
              </span>
            </div>
          </li>
          <li className="bg-white dark:bg-black rounded-lg p-5 border-2 border-black dark:border-white">
            <div className="flex items-start">
              <span className="font-bold text-lg mr-4">2</span>
              <span>
                Along with the conditional markets of a milestone, <span className="font-semibold text-black dark:text-white">there are also the prediction markets of how likely a milestone is to be reached</span>.
              </span>
            </div>
          </li>
          <li className="bg-white dark:bg-black rounded-lg p-5 border-2 border-black dark:border-white">
            <div className="flex items-start">
              <span className="font-bold text-lg mr-4">3</span>
              <span>
                Once a milestone end time is reached, <span className="font-semibold text-black dark:text-white">markets close and token payouts are distributed according to the actual measured outcome of the milestone</span>.
              </span>
            </div>
          </li>
        </ol>
        <div className="mt-10 flex justify-end">
          <button
            className="bg-black dark:bg-white text-white dark:text-black font-bold px-7 py-2.5 rounded-lg border-2 border-black dark:border-white shadow focus:outline-none transition-all"
            onClick={onClose}
          >
            Got it
          </button>
        </div>
        </div>
      </div>
      {/* Animation keyframes */}
      <style>{`
        .animate-fadeInScale {
          animation: fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes fadeInScale {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

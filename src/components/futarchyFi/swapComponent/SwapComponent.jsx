import {
  SplitIcon,
  MergeIcon,
  PlusIcon,
  MinusIcon,
  ReloadIcon,
} from "./Resources"; // Assuming you use Heroicons
import { useState, useEffect, useRef } from "react";


export default function SwapComponent({
  isOpen,
  onClose,
  quiverToken,
  yesToken,
  noToken,
  setQuiverToken,
  setYesToken,
  setNoToken,
  testingOn = false,
}) {
  const [splitAmount, setSplitAmount] = useState(1);
  const [mergeAmount, setMergeAmount] = useState(1);
  const [showSplitWarning, setShowSplitWarning] = useState(false);
  const [showMergeWarning, setShowMergeWarning] = useState(false);
  const [isSplitMode, setIsSplitMode] = useState(true);
  const [rotateIcon, setRotateIcon] = useState(false);
  const modalRef = useRef(null);
  const [rotateAngle, setRotateAngle] = useState(0);

  const handleIncrement = (amount, setAmount, max) => {
    setAmount((prev) => Math.min(prev + 1, max));
  };

  const handleDecrement = (amount, setAmount) => {
    setAmount((prev) => Math.max(prev - 1, 0));
  };

  const handleSwap = () => {
    setIsSplitMode(!isSplitMode);
    setRotateAngle((prevAngle) => prevAngle + 180);
  };

  const handleConversion = () => {
    if (isSplitMode) {
      handleSplit();
    } else {
      handleMerge();
    }
  };

  const handleSplit = () => {
    if (quiverToken >= splitAmount) {
      setQuiverToken(quiverToken - splitAmount);
      setYesToken(yesToken + splitAmount);
      setNoToken(noToken + splitAmount);
      setShowSplitWarning(false);
    } else {
      setShowSplitWarning(true);
    }
  };

  const handleMerge = () => {
    if (yesToken >= mergeAmount && noToken >= mergeAmount) {
      setYesToken(yesToken - mergeAmount);
      setNoToken(noToken - mergeAmount);
      setQuiverToken(quiverToken + mergeAmount);
      setShowMergeWarning(false);
    } else {
      setShowMergeWarning(true);
    }
  };

  const handleOverlayClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [isOpen]);

  useEffect(() => {
    // Update splitAmount if it exceeds available quiverToken
    setSplitAmount((prev) => Math.min(prev, quiverToken));
  }, [quiverToken]);

  useEffect(() => {
    // Update mergeAmount if it exceeds available yes/no tokens
    const maxMergeAmount = Math.min(yesToken, noToken);
    setMergeAmount((prev) => Math.min(prev, maxMergeAmount));
  }, [yesToken, noToken]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 font-oxanium select-none"
      onClick={handleOverlayClick}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        ref={modalRef}
        className="relative w-[600px] p-8 bg-white shadow-lg transform-gpu transition-transform hover:scale-[1.02]"
      >
        <div className="text-center bg-black p-6 -mx-8 -mt-8">
          <p className="text-white text-xl font-medium">Token Swap</p>
        </div>
        <button
          className="absolute top-4 right-4 p-2 text-white transition-transform hover:rotate-90 duration-300"
          onClick={onClose}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M6 18L18 6M6 6l12 12" strokeWidth="2" />
          </svg>
        </button>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 grid-rows-[auto_min-content_auto] gap-4 relative mt-8">
          {/* Token Wrappers */}
          <div
            className={`overflow-hidden relative flex flex-row items-center justify-between bg-gray/15 p-4 h-32 shadow-xl w-full transition-transform duration-500 group ${
              isSplitMode ? "row-start-1" : "row-start-3"
            }`}
          >
            {/* Hover gradient effect */}
            <div
              className="absolute inset-0 -translate-x-full group-hover:translate-x-full 
              transition-transform duration-1000 ease-in-out
              bg-gradient-to-r from-transparent via-white to-transparent"
            />

            {/* Top highlight effect */}
            <div
              className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100
              transition-opacity duration-300
              bg-gradient-to-r from-transparent via-white/50 to-transparent"
            />

            {/* Main content */}
            <div className="text-left gap-2 flex flex-row items-center relative z-10">
              <h2 className="text-lg font-medium text-black">Quiver Tokens:</h2>
              <p className="text-xl text-black">{quiverToken}</p>
            </div>
            <div className="flex flex-row items-center border border-black w-1/3 relative z-10">
              <input
                type="number"
                min="0"
                max={quiverToken}
                step="1"
                value={splitAmount}
                onChange={(e) =>
                  setSplitAmount(
                    Math.min(Math.max(Number(e.target.value), 0), quiverToken)
                  )
                }
                className="text-black w-full h-14 p-2 bg-transparent appearance-auto border-r border-black"
              />
              <div className="flex flex-col h-full w-10">
                <button
                  onClick={() =>
                    handleIncrement(splitAmount, setSplitAmount, quiverToken)
                  }
                  className="flex items-center justify-center bg-gray-300 border-b border-black h-7 w-full"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDecrement(splitAmount, setSplitAmount)}
                  className="flex items-center justify-center bg-gray-300 h-7 w-full"
                >
                  <MinusIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Swap Button */}
          <div className="place-self-center row-start-2">
            <button
              onClick={handleSwap}
              className="rounded-full bg-gray/10 border-2 border-gray/15 p-2 transition-transform duration-300"
              style={{
                transform: `rotate(${rotateAngle}deg)`, // Apply cumulative rotation
              }}
            >
              <ReloadIcon className="w-6 h-6" />
            </button>
          </div>

          <div
            className={`relative flex flex-row items-center h-32 justify-between bg-tertiary p-4 shadow-md w-full transition-transform duration-500 group overflow-hidden ${
              isSplitMode ? "row-start-3" : "row-start-1"
            }`}
          >
            {/* Hover gradient effect */}
            <div
              className="absolute inset-0 -translate-x-full group-hover:translate-x-full 
              transition-transform duration-1000 ease-in-out
              bg-gradient-to-r from-transparent via-gray/40 to-transparent"
            />

            {/* Top highlight effect */}
            <div
              className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100
              transition-opacity duration-300
              bg-gradient-to-r from-transparent via-white/50 to-transparent"
            />

            {/* Main content */}
            <div className="text-left flex flex-col items-center relative z-10">
              <h2 className="text-lg font-medium">Yes / No Tokens</h2>
              <p className="text-xl">Yes: {yesToken}</p>
              <p className="text-xl">No: {noToken}</p>
            </div>
            <div className="flex flex-row items-center border border-white w-1/3 relative z-10">
              <input
                type="number"
                min="0"
                max={Math.min(yesToken, noToken)}
                step="1"
                value={mergeAmount}
                onChange={(e) =>
                  setMergeAmount(
                    Math.min(
                      Math.max(Number(e.target.value), 0),
                      Math.min(yesToken, noToken)
                    )
                  )
                }
                className="text-white w-full h-14 p-2 bg-transparent appearance-auto border-r border-white"
              />
              <div className="flex flex-col h-full w-10">
                <button
                  onClick={() =>
                    handleIncrement(
                      mergeAmount,
                      setMergeAmount,
                      Math.min(yesToken, noToken)
                    )
                  }
                  className="flex items-center justify-center bg-gray-300 border-b border-white h-7 w-full"
                >
                  <PlusIcon className="w-4 h-4 fill-white" />
                </button>
                <button
                  onClick={() => handleDecrement(mergeAmount, setMergeAmount)}
                  className="flex items-center justify-center bg-gray-300 h-7 w-full"
                >
                  <MinusIcon className="w-4 h-4 fill-white" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Unified Conversion Button */}
        <button
          className="text-hover-black-white-shadow relative w-full px-4 py-3 bg-black border text-white hover:text-black hover:font-bold font-semibold transition-colors duration-300 flex items-center justify-center gap-1 mt-4 overflow-hidden group
          hover:bg-futarchyGray
          hover:shadow-[0_0_15px_rgba(182,80,158,0.3)]"
          onClick={handleConversion}
        >
          <div
            className="absolute inset-0 -translate-x-full group-hover:translate-x-full 
              transition-transform duration-1000 ease-in-out
              bg-gradient-to-r from-transparent via-lightGray/40 to-transparent"
          />

          {/* Top highlight effect */}
          <div
            className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100
              transition-opacity duration-300
              bg-gradient-to-r from-transparent via-white/50 to-transparent"
          />

          {isSplitMode ? (
            <>
              <SplitIcon className="w-6 h-6" />
              Split Tokens
            </>
          ) : (
            <>
              <MergeIcon className="w-6 h-6" />
              Merge Tokens
            </>
          )}
        </button>

        {/* Testing controls */}
        {testingOn && (
          <div className="space-y-4 mt-4 text-left bg-black p-4 ">
            <h3 className="font-semibold text-lg text-white">
              Testing Controls
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuiverToken(quiverToken + 1)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                + Quiver
              </button>
              <button
                onClick={() => setQuiverToken(Math.max(quiverToken - 1, 0))}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                - Quiver
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setYesToken(yesToken + 1)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                + Yes
              </button>
              <button
                onClick={() => setYesToken(Math.max(yesToken - 1, 0))}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                - Yes
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNoToken(noToken + 1)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                + No
              </button>
              <button
                onClick={() => setNoToken(Math.max(noToken - 1, 0))}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                - No
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

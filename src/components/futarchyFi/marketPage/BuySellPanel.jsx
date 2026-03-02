import React, { useState, useMemo, useEffect } from "react";
import './shared/MarketPanels.css';
import Slider from "./Slider";
import ToggleButton from "./ToggleButton";
import CheckboxButton from "./CheckboxButton";
import SwapComponent from "../swapComponent/SwapComponent";

const BuySellPanel = ({
  selectedMarket,
  availableToTrade,
  priceBand = {
    approval: { high: 120, low: 80 },
    refusal: { high: 120, low: 80 },
  },
  isOpen,
  onTogglePanel,
  precision = { price: 2, amount: 4 },
}) => {
  // State definitions
  const [side, setSide] = useState("bid"); // 'bid' or 'ask'
  const [inputMode, setInputMode] = useState("cost"); // 'cost' or 'size'
  const [outcome, setOutcome] = useState("approval"); // 'approval' or 'reproval'
  const [inputValue, setInputValue] = useState(""); // empty by default
  const [error, setError] = useState("");
  const [leverage, setLeverage] = useState(1); // New leverage state
  const [debugOutput, setDebugOutput] = useState(null);
  const [isLimitOrder, setIsLimitOrder] = useState(false);
  const [limitPrice, setLimitPrice] = useState("");
  const [limitPriceError, setLimitPriceError] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [quiverToken, setQuiverToken] = useState(10);
  const [yesToken, setYesToken] = useState(40);
  const [noToken, setNoToken] = useState(30);

  // Handlers for new buy/sell button group
  const handleBuyTrade = () => {
    console.log("buyTrade");
    setSide("bid");
  };

  const handleSellTrade = () => {
    console.log("sellTrade");
    setSide("ask");
  };

  // Toggle handler to update inputMode based on ToggleButton state
  const handleInputModeToggle = (id, isActive) => {
    setInputMode(isActive ? "size" : "cost");
  };

  // Handler to toggle limit order
  const handleLimitOrderToggle = (id, isActive) => {
    setIsLimitOrder(isActive);
  };

  // Determine the appropriate market value and available to trade based on outcome state
  const currencyMarketValue =
    outcome === "approval"
      ? selectedMarket.approval.marketValue
      : selectedMarket.refusal.marketValue;

  const availableToTradeValue =
    outcome === "approval"
      ? availableToTrade.approval
      : availableToTrade.refusal;

  // Calculate the maximum allowable input value based on inputMode and outcome
  const maxCostValue = availableToTradeValue;
  const maxSizeValue = availableToTradeValue / currencyMarketValue;

  // Helper function to round numbers to specific precision
  const roundToPrecision = (value, precision) => {
    return Number(Math.round(value + "e" + precision) + "e-" + precision);
  };

  // Calculate amount based on inputValue and inputMode with precision
  const amount = useMemo(() => {
    if (inputValue === "" || inputValue <= 0) return 0;
    const calculatedAmount =
      inputMode === "cost" ? inputValue / currencyMarketValue : inputValue;
    return roundToPrecision(calculatedAmount, precision.amount);
  }, [inputValue, inputMode, currencyMarketValue, precision.amount]);

  // Modify handleInputChange to just update the value without validation
  const handleInputChange = (e) => {
    const value = e.target.value;
    if (value === "" || !isNaN(value)) {
      // Allow empty or numeric values only
      setInputValue(value);
      setError(""); // Clear any existing error while typing
    }
  };

  // Handle all validation and precision when leaving the input
  const handleInputBlur = () => {
    if (inputValue === "") return;

    const numValue = Number(inputValue);
    const maxValue = inputMode === "cost" ? maxCostValue : maxSizeValue;
    const precisionToUse =
      inputMode === "cost" ? precision.price : precision.amount;

    if (numValue > maxValue) {
      setError(`Value exceeds maximum allowed: ${maxValue}`);
    } else {
      // Only round the number when user finishes typing
      const roundedValue = roundToPrecision(numValue, precisionToUse);
      setInputValue(String(roundedValue)); // Convert to string for input value
      setError("");
    }
  };

  // Update inputValue if inputMode or outcome changes and exceeds the new limit
  useEffect(() => {
    if (inputValue !== "" && inputValue > maxCostValue) {
      setInputValue(maxCostValue);
    }
  }, [maxCostValue, inputMode, outcome]);

  // Toggle outcome with SwitchButton component
  const handleOutcomeToggle = (side) => {
    const newOutcome = side === "left" ? "approval" : "refusal";
    console.log("Switching outcome to:", newOutcome);
    setOutcome(newOutcome);
  };

  // Modify the input mode toggle to handle value conversion
  const handleInputModeChange = (newMode) => {
    console.log("--- Debug handleInputModeChange ---");
    console.log("Current Mode:", inputMode);
    console.log("New Mode:", newMode);
    console.log("Current Value:", inputValue);
    console.log("Market Value:", currencyMarketValue);
    console.log("Max Cost Value:", maxCostValue);
    console.log("Max Size Value:", maxSizeValue);

    if (inputValue === "") {
      setInputMode(newMode);
      return;
    }

    const currentValue = Number(inputValue);
    if (currentValue <= 0) {
      setInputMode(newMode);
      return;
    }

    let newValue;
    if (newMode === "size" && inputMode === "cost") {
      newValue = currentValue / currencyMarketValue;
      console.log(
        "Converting cost to size:",
        currentValue,
        "/",
        currencyMarketValue,
        "=",
        newValue
      );
      newValue = Math.min(newValue, maxSizeValue);
      newValue = roundToPrecision(newValue, precision.amount);
    } else if (newMode === "cost" && inputMode === "size") {
      newValue = currentValue * currencyMarketValue;
      console.log(
        "Converting size to cost:",
        currentValue,
        "*",
        currencyMarketValue,
        "=",
        newValue
      );
      newValue = Math.min(newValue, maxCostValue);
      newValue = roundToPrecision(newValue, precision.price);
    }

    console.log("Final new value:", newValue);

    setInputValue(newValue);
    setInputMode(newMode);
  };

  // Validate limit price against price band
  const validateLimitPrice = (price) => {
    if (!price) return;

    const numPrice = Number(price);
    const currentPriceBand = priceBand[outcome];

    if (side === "bid") {
      if (numPrice < currentPriceBand.low || numPrice > currentPriceBand.high) {
        setLimitPriceError(
          `Price must be between ${currentPriceBand.low} and ${currentPriceBand.high}`
        );
      } else {
        setLimitPriceError("");
      }
    } else {
      if (numPrice < currentPriceBand.low || numPrice > currentPriceBand.high) {
        setLimitPriceError(
          `Price must be between ${currentPriceBand.low} and ${currentPriceBand.high}`
        );
      } else {
        setLimitPriceError("");
      }
    }
  };

  // Handle limit price input
  const handleLimitPriceChange = (e) => {
    const value = e.target.value;
    if (value === "" || !isNaN(value)) {
      setLimitPrice(value);
      setLimitPriceError("");
    }
  };

  // Validate limit price on blur
  const handleLimitPriceBlur = () => {
    if (!limitPrice) return;

    const numPrice = Number(limitPrice);
    const roundedPrice = roundToPrecision(numPrice, precision.price);
    setLimitPrice(String(roundedPrice));
    validateLimitPrice(roundedPrice);
  };

  // Modify getCurrentPrice to use limit price when applicable
  const getCurrentPrice = () => {
    if (isLimitOrder && limitPrice) {
      return Number(limitPrice);
    }
    const currentPriceBand = priceBand[outcome];
    return side === "bid" ? currentPriceBand.high : currentPriceBand.low;
  };

  // Handle trade execution
  const handleTrade = (tradeSide) => {
    if (error || !inputValue || (isLimitOrder && limitPriceError)) {
      return;
    }

    const tradeDetails = {
      side: tradeSide,
      amount: Number(Number(inputValue).toFixed(precision.amount)),
      price: Number(getCurrentPrice().toFixed(precision.price)),
      symbol: selectedMarket[outcome].symbol,
      leverage,
      isLimitOrder,
    };

    console.log("Trade Details:", tradeDetails);
    setDebugOutput(tradeDetails);
  };

  return (
    <>
      {/* Mobile Slide-In Panel */}
  <div
    className={`fixed bottom-0 left-0 w-full h-full transform transition-transform duration-300 z-50 md:hidden font-oxanium ${
      isOpen ? "translate-y-0" : "translate-y-48"
    }`}
  >
    <div className="p-4 flex flex-col h-full text-black bg-white/35 backdrop-blur-sm shadow-lg ">
      {/* Header for Slide-In Panel */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-black">Trade Panel</h2>
        <button
          onClick={onTogglePanel}
          className="text-sm font-semibold text-red-500"
        >
          Close
        </button>
      </div>

      {/* Buy/Sell Buttons */}
      <div className="flex p-4 border-b">
        <button
          onClick={handleBuyTrade}
          className={`flex-1 py-2 px-4 transition-all duration-200 border-2 ${
            side === "bid"
              ? "border-futarchyLavender bg-futarchyLavender/50 text-[#3A3E98] font-bold shadow-md"
              : "border-transparent hover:border-gray-200 hover:bg-gray-200"
          }`}
        >
          Buy
        </button>
        <button
          onClick={handleSellTrade}
          className={`flex-1 py-2 px-4 transition-all duration-200 border-2 ${
            side === "ask"
              ? "border-futarchyOrange bg-futarchyOrange/50 text-[#8D4E30] font-bold shadow-md"
              : "border-transparent hover:border-gray-200 hover:bg-gray-200"
          }`}
        >
          Sell
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-grow overflow-y-auto px-4">
        {/* Input Mode Toggle */}
        <div className="flex items-start justify-start mt-4">
          <span className="mr-3 text-base font-semibold">Cost</span>
          <ToggleButton
            id="inputModeToggle"
            isActive={inputMode === "size"}
            onToggle={handleInputModeToggle}
            ariaLabel="Toggle between cost and size"
            activeBgColor={
              side === "bid" ? "bg-futarchyLavender" : "bg-futarchyOrange"
            }
            activeBorderColor={
              side === "bid"
                ? "border-futarchyLavenderDark"
                : "border-futarchyOrangeDark"
            }
          />
          <span className="ml-3 text-base font-semibold">Size</span>
        </div>

        {/* Cost/Size Input */}
        <div className="mt-4">
          <label className="block text-sm font-medium mb-2">
            {inputMode === "cost" ? "Cost Amount" : "Size Amount"}
          </label>
          <input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            className={`h-12 w-full px-2 py-1 border placeholder-darkGray/75 bg-transparent transition-colors duration-200 ${
              error
                ? "border-futarchyRedNo/50 bg-futarchyRedNo/5"
                : "border-gray-300"
            }`}
            placeholder={`Enter ${inputMode}`}
          />
          {error && <p className="mt-1 text-sm text-futarchyRedNo">{error}</p>}
        </div>

        {/* Limit Order Section */}
        <div className="space-y-2 mt-4">
          <CheckboxButton
            id="limitOrderCheckbox"
            isActive={isLimitOrder}
            onToggle={handleLimitOrderToggle}
            text="Limit Order"
            ariaLabel="Toggle limit order"
            activeBorderColor={
              side === "bid" ? "futarchyLavenderDark" : "futarchyOrangeDark"
            }
            activeBgColor={
              side === "bid" ? "bg-futarchyLavender" : "bg-futarchyOrange"
            }
            inactiveColor="border-darkGray"
          />
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              isLimitOrder
                ? "max-h-20 opacity-100 mt-2"
                : "max-h-0 opacity-0"
            }`}
          >
            <input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className={`w-full p-3 border bg-transparent placeholder-darkGray/75 ${
                limitPriceError
                  ? "border-futarchyRedNo/50 bg-futarchyRedNo/5"
                  : "border-gray-300"
              }`}
              placeholder="Enter limit price"
            />
            {limitPriceError && (
              <p className="mt-1 text-sm text-futarchyRedNo">
                {limitPriceError}
              </p>
            )}
          </div>
        </div>

        {/* Leverage Slider */}
        <div className="mt-4">
          <label className="block text-sm font-medium mb-2">
            Leverage: {leverage}x
          </label>
          <Slider
            steps={9}
            defaultValue={leverage}
            min={1}
            max={10}
            onChange={(newValue) => setLeverage(newValue)}
            activeTrackColor={
              side === "bid" ? "bg-futarchyLavender" : "bg-futarchyOrange"
            }
            inactiveTrackColor={
              side === "bid"
                ? "bg-futarchyLavenderDark"
                : "bg-futarchyOrangeDark"
            }
            activeStepColor={
              side === "bid" ? "bg-futarchyLavender" : "bg-futarchyOrange"
            }
            inactiveStepColor={
              side === "bid"
                ? "bg-futarchyLavenderDark"
                : "bg-futarchyOrangeDark"
            }
            thumbBgColor={
              side === "bid" ? "bg-futarchyLavender" : "bg-futarchyOrange"
            }
            thumbBorderColor={
              side === "bid"
                ? "border-futarchyLavenderDark"
                : "border-futarchyOrangeDark"
            }
          />
        </div>

        {/* Select Outcome Section */}
        <div className="mt-4 pb-4 border-b ">
          <label className="block text-sm font-medium mb-2">
            Select Outcome
          </label>
          <div className="flex">
            <button
              onClick={() => setOutcome("approval")}
              className={`flex-1 py-2 px-4 transition-all duration-200 border-2 ${
                outcome === "approval"
                  ? side === "bid"
                    ? "border-futarchyLavender bg-futarchyLavender/50 text-[#3A3E98] font-bold shadow-md"
                    : "border-futarchyOrange bg-futarchyOrange/50 text-[#8D4E30] font-bold shadow-md"
                  : "border-transparent hover:border-gray-200 hover:bg-gray-200"
              }`}
            >
              Approval
            </button>
            <button
              onClick={() => setOutcome("refusal")}
              className={`flex-1 py-2 px-4 transition-all duration-200 border-2 ${
                outcome === "refusal"
                  ? side === "bid"
                    ? "border-futarchyLavender bg-futarchyLavender/50 text-[#3A3E98] font-bold shadow-md"
                    : "border-futarchyOrange bg-futarchyOrange/50 text-[#8D4E30] font-bold shadow-md"
                  : "border-transparent hover:border-gray-200 hover:bg-gray-200"
              }`}
            >
              Refusal
            </button>
          </div>
          
        </div>
        {/* Information Section */}
        <div className="space-y-1 mt-2">
              <div className="flex justify-between text-sm">
                <span>Liquidation Price</span>
                <span className="font-medium">2161.5</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Order Value</span>
                <span className="font-medium">$-</span>
              </div>

              {/* Expandable Content with Transition */}
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  showMore ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="flex justify-between text-sm mt-1">
                  <span>Margin Required</span>
                  <span className="font-medium">$-</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Slippage</span>
                  <span className="font-medium">-</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Fees</span>
                  <span className="font-medium">0% to 0.1%</span>
                </div>
              </div>

              {/* Show More Button */}
              <button
                onClick={() => setShowMore(!showMore)}
                className={`w-full text-sm text-center font-bold ${
                  side === "bid"
                    ? "text-futarchyLavenderDark"
                    : "text-futarchyOrangeDark"
                }`}
              >
                {showMore ? "Less Info" : "More Info"}
              </button>
            </div>

            {/* Account Section */}
            <div className="text-base font-semibold text-black mt-4">
              Account
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Available Balance:</span>
                <span className="font-medium">
                  {outcome === "approval"
                    ? `${availableToTrade.approval.toFixed(
                        precision.price
                      )} USDC`
                    : `${availableToTrade.refusal.toFixed(
                        precision.price
                      )} USDC`}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Market Value:</span>
                <span className="font-medium">
                  {outcome === "approval"
                    ? `${selectedMarket.approval.marketValue} (${selectedMarket.approval.symbol})`
                    : `${selectedMarket.refusal.marketValue} (${selectedMarket.refusal.symbol})`}
                </span>
              </div>
            </div>

        {/* Market Details Section */}
        <div className="mt-4">
          {/* Details go here */}
          {/* Use the same details structure from the desktop version */}
        </div>
      </div>

      {/* Action Button */}
      <div className="p-4">
        <button
          onClick={() => handleTrade(side)}
          className={`w-full h-12 font-semibold text-base transition-all duration-200 border-2 ${
            side === "bid"
              ? "border-futarchyLavender bg-futarchyLavender/50 text-[#3A3E98] shadow-md"
              : "border-futarchyOrange bg-futarchyOrange/50 text-[#8D4E30] shadow-md"
          }`}
        >
          {side === "bid" ? "Buy | Long" : "Sell | Short"}
        </button>
      </div>

      {/* SwapComponent Modal */}
      <SwapComponent
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        quiverToken={quiverToken}
        yesToken={yesToken}
        noToken={noToken}
        setQuiverToken={setQuiverToken}
        setYesToken={setYesToken}
        setNoToken={setNoToken}
      />
    </div>
  </div>

{/* Desktop Version*/}

      <div className="bg-white/35 backdrop-blur-sm shadow-lg text-black font-oxanium overflow-hidden hidden md:block">
        {/* Header Section */}
        <div className="flex p-4 border-b">
          <button
            onClick={handleBuyTrade}
            className={`flex-1 py-2 px-4 transition-all duration-200 border-2 ${
              side === "bid"
                ? "border-futarchyLavender bg-futarchyLavender/50 text-[#3A3E98] font-bold shadow-md" // Darker lavender
                : "border-transparent hover:border-gray-200 hover:bg-gray-200"
            }`}
          >
            Buy
          </button>
          <button
            onClick={handleSellTrade}
            className={`flex-1 py-2 px-4 transition-all duration-200 border-2 ${
              side === "ask"
                ? "border-futarchyOrange bg-futarchyOrange/50 text-[#8D4E30] font-bold shadow-md" // Darker orange
                : "border-transparent hover:border-gray-200 hover:bg-gray-200"
            }`}
          >
            Sell
          </button>
        </div>
        {/* Input Mode Toggle with ToggleButton */}
        <div className="flex items-start justify-start px-4 mt-4">
          <span className="mr-3 text-base font-semibold">Cost</span>
          <ToggleButton
            id="inputModeToggle"
            isActive={inputMode === "size"}
            onToggle={handleInputModeToggle}
            ariaLabel="Toggle between cost and size"
            activeBgColor={
              side === "bid" ? "bg-futarchyLavender" : "bg-futarchyOrange"
            } // Consistent background color
            activeBorderColor={
              side === "bid"
                ? "border-futarchyLavenderDark"
                : "border-futarchyOrangeDark"
            } // Consistent border color
          />
          <span className="ml-3 text-base font-semibold">Size</span>
        </div>
        <div className="px-4 mt-4">
          <label className="block text-sm font-medium mb-2">
            {inputMode === "cost" ? "Cost Amount" : "Size Amount"}
          </label>
          <input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            className={`h-12 w-full px-2 py-1 border placeholder-darkGray/75 bg-transparent transition-colors duration-200 ${
              error
                ? "border-futarchyRedNo/50 bg-futarchyRedNo/5"
                : "border-gray-300"
            }`}
            placeholder={`Enter ${inputMode}`}
          />
          {error && <p className="mt-1 text-sm text-futarchyRedNo">{error}</p>}
        </div>
        {/* Input Fields */}
        <div className="space-y-4 px-4">
          {/* Limit Order Section */}
          <div className="space-y-2 mt-4">
            <CheckboxButton
              id="limitOrderCheckbox"
              isActive={isLimitOrder}
              onToggle={handleLimitOrderToggle}
              text="Limit Order"
              ariaLabel="Toggle limit order"
              activeBorderColor={
                side === "bid" ? "futarchyLavenderDark" : "futarchyOrangeDark"
              } // Darker border colors
              activeBgColor={
                side === "bid" ? "bg-futarchyLavender" : "bg-futarchyOrange"
              } // Standard background colors
              inactiveColor="border-darkGray"
              className=""
            />

            {/* Limit Price Input with Transition */}
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                isLimitOrder ? "max-h-20 opacity-100 mt-2" : "max-h-0 opacity-0"
              }`}
            >
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                onBlur={() => {
                  // validation logic here
                }}
                className={`w-full p-3 border bg-transparent placeholder-darkGray/75 ${
                  limitPriceError
                    ? "border-futarchyRedNo/50 bg-futarchyRedNo/5"
                    : "border-gray-300"
                }`}
                placeholder="Enter limit price"
              />
              {limitPriceError && (
                <p className="mt-1 text-sm text-futarchyRedNo">
                  {limitPriceError}
                </p>
              )}
            </div>
          </div>

          {/* Leverage Slider */}
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">
              Leverage: {leverage}x
            </label>
            <Slider
              steps={9}
              defaultValue={leverage}
              min={1}
              max={10}
              onChange={(newValue) => setLeverage(newValue)}
              numberHandleSlider={false}
              activeTrackColor={
                side === "bid" ? "bg-futarchyLavender" : "bg-futarchyOrange"
              }
              inactiveTrackColor={
                side === "bid"
                  ? "bg-futarchyLavenderDark"
                  : "bg-futarchyOrangeDark"
              }
              activeStepColor={
                side === "bid" ? "bg-futarchyLavender" : "bg-futarchyOrange"
              }
              inactiveStepColor={
                side === "bid"
                  ? "bg-futarchyLavenderDark"
                  : "bg-futarchyOrangeDark"
              }
              thumbBgColor={
                side === "bid" ? "bg-futarchyLavender" : "bg-futarchyOrange"
              }
              thumbBorderColor={
                side === "bid"
                  ? "border-futarchyLavenderDark"
                  : "border-futarchyOrangeDark"
              }
            />
          </div>
        </div>
        {/* Approval/Refusal Buttons Section */}
        <div className="mt-4 px-4 pb-4 border-b">
          <label className="block text-sm font-medium mb-2">
            Select Outcome
          </label>
          <div className="flex">
            <button
              onClick={() => setOutcome("approval")}
              className={`flex-1 py-2 px-4 transition-all duration-200 border-2 ${
                outcome === "approval"
                  ? side === "bid"
                    ? "border-futarchyLavender bg-futarchyLavender/50 text-[#3A3E98] font-bold shadow-md"
                    : "border-futarchyOrange bg-futarchyOrange/50 text-[#8D4E30] font-bold shadow-md"
                  : "border-transparent hover:border-gray-200 hover:bg-gray-200"
              }`}
            >
              Approval
            </button>
            <button
              onClick={() => setOutcome("refusal")}
              className={`flex-1 py-2 px-4 transition-all duration-200 border-2 ${
                outcome === "refusal"
                  ? side === "bid"
                    ? "border-futarchyLavender bg-futarchyLavender/50 text-[#3A3E98] font-bold shadow-md"
                    : "border-futarchyOrange bg-futarchyOrange/50 text-[#8D4E30] font-bold shadow-md"
                  : "border-transparent hover:border-gray-200 hover:bg-gray-200"
              }`}
            >
              Refusal
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 border-b">
          {/* Market Details Section */}
          <div className="space-y-2">
            <div className="text-base font-semibold text-black mb-2">
              Market Details
            </div>

            {/* Information Section */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Liquidation Price</span>
                <span className="font-medium">2161.5</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Order Value</span>
                <span className="font-medium">$-</span>
              </div>

              {/* Expandable Content with Transition */}
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  showMore ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="flex justify-between text-sm mt-1">
                  <span>Margin Required</span>
                  <span className="font-medium">$-</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Slippage</span>
                  <span className="font-medium">-</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Fees</span>
                  <span className="font-medium">0% to 0.1%</span>
                </div>
              </div>

              {/* Show More Button */}
              <button
                onClick={() => setShowMore(!showMore)}
                className={`w-full text-sm text-center font-bold ${
                  side === "bid"
                    ? "text-futarchyLavenderDark"
                    : "text-futarchyOrangeDark"
                }`}
              >
                {showMore ? "Less Info" : "More Info"}
              </button>
            </div>

            {/* Account Section */}
            <div className="text-base font-semibold text-black mt-4">
              Account
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Available Balance:</span>
                <span className="font-medium">
                  {outcome === "approval"
                    ? `${availableToTrade.approval.toFixed(
                        precision.price
                      )} USDC`
                    : `${availableToTrade.refusal.toFixed(
                        precision.price
                      )} USDC`}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Market Value:</span>
                <span className="font-medium">
                  {outcome === "approval"
                    ? `${selectedMarket.approval.marketValue} (${selectedMarket.approval.symbol})`
                    : `${selectedMarket.refusal.marketValue} (${selectedMarket.refusal.symbol})`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4">
          <button
            onClick={() => handleTrade(side)}
            className={`w-full h-12 font-semibold text-base transition-all duration-200 border-2 ${
              side === "bid"
                ? "border-futarchyLavender bg-futarchyLavender/50 text-[#3A3E98] shadow-md" // Lavender for Buy | Long
                : "border-futarchyOrange bg-futarchyOrange/50 text-[#8D4E30] shadow-md" // Orange for Sell | Short
            }`}
          >
            {side === "bid" ? "Buy | Long" : "Sell | Short"}
          </button>
        </div>
      </div>
    </>
  );
};

export default BuySellPanel;

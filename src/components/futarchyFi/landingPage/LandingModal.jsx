import React, { useState, useEffect, useRef } from "react";
import ToggleButton from "./ToggleButton";

const ApprovalIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M23.0606 5.99999L8.99999 20.0607L0.939331 12L1.99999 10.9393L8.99999 17.9393L22 4.93933L23.0606 5.99999Z"
      fill="currentColor"
    />
  </svg>
);

const LandingModal = ({ handleClose, onApplyClick }) => {
  const [showEthField, setShowEthField] = useState(false);
  const [email, setEmail] = useState("");
  const [ethAddress, setEthAddress] = useState("");
  const [errors, setErrors] = useState({ email: "", ethAddress: "" });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const bannerRef = React.useRef(null);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateEthAddress = (address) => {
    const ethRegex = /^0x[a-fA-F0-9]{40}$/;
    return ethRegex.test(address);
  };

  const handleSubmit = async () => {
    setHasSubmitted(true);

    const emailValid = validateEmail(email);
    const ethValid = !showEthField || validateEthAddress(ethAddress);

    const [emailName, emailDomain] = email.split("@");
    const encodedEmail = btoa(email);
    const encodedEthAddress = ethAddress ? btoa(ethAddress) : "none";

    if (emailValid && ethValid) {
      const formData = new FormData();
      formData.append("email", email);
      if (showEthField) {
        formData.append("user_wallet", ethAddress);
      }

      // Send analytics data
      const analyticsData = {
        event_category: "engagement",
        event_label: "early_access_form",
        email_name: emailName,
        email_domain: emailDomain,
        email_full: encodedEmail,
        has_eth: showEthField ? 1 : 0,
        user_wallet: encodedEthAddress,
        value: showEthField ? 1 : 0,
      };

      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "waitlist_signup", analyticsData);
      }

      // Send data to FormBold API
      try {
        const response = await fetch("https://formbold.com/s/6vgqN", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          setIsSuccess(true);
        }
      } catch (error) {
        // Silently fail — don't block user experience
      }
    } else {
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "form_error", {
          event_category: "error",
          event_label: !emailValid ? "invalid_email" : "invalid_eth_address",
          error_type: !emailValid
            ? "email_validation"
            : !ethValid
            ? "eth_validation"
            : "unknown",
          email_provided: email ? 1 : 0,
          eth_field_shown: showEthField ? 1 : 0,
        });
      }

      setErrors({
        email: !emailValid ? "Please enter a valid email address" : "",
        ethAddress:
          showEthField && !ethValid ? "Please enter a valid EVM address" : "",
      });
    }
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (hasSubmitted && value && !validateEmail(value)) {
      setErrors((prev) => ({
        ...prev,
        email: "Please enter a valid email address",
      }));
    } else {
      setErrors((prev) => ({ ...prev, email: "" }));
    }
  };

  const handleEthAddressChange = (e) => {
    const value = e.target.value;
    setEthAddress(value);
    if (hasSubmitted && value && !validateEthAddress(value)) {
      setErrors((prev) => ({
        ...prev,
        ethAddress: "Please enter a valid EVM address",
      }));
    } else {
      setErrors((prev) => ({ ...prev, ethAddress: "" }));
    }
  };

  useEffect(() => {
    const banner = bannerRef.current;
    if (!banner) return;

    const handleMouseMove = (e) => {
      const rect = banner.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rotateX = ((y - rect.height / 2) / rect.height) * 30; // Increased from 20 to 30
      const rotateY = ((x - rect.width / 2) / rect.width) * 30; // Increased from 20 to 30

      banner.style.transform = `perspective(1000px) rotateX(${-rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`; // Added scale

      // Update highlight position
      const highlightX = ((x / rect.width) * 100).toFixed(2);
      const highlightY = ((y / rect.height) * 100).toFixed(2);
      banner.style.setProperty("--highlight-x", `${highlightX}%`);
      banner.style.setProperty("--highlight-y", `${highlightY}%`);
    };

    const handleMouseLeave = () => {
      banner.style.transform =
        "perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)";
    };

    banner.addEventListener("mousemove", handleMouseMove);
    banner.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      banner.removeEventListener("mousemove", handleMouseMove);
      banner.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  if (isSuccess) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-40">
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative w-[393px] md:w-[480px] bg-white border border-darkGray p-6">
          {/* Close Button */}
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={handleClose}
              className="p-2 text-black/60 hover:text-black transition-colors hover:rotate-90 transform duration-300"
            >
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M6 18L18 6M6 6l12 12"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Modal Content */}
          <div className="space-y-8 text-center">
            <div className="relative">
              <div className="w-24 h-24 mx-auto mb-6 relative">
                <div className="bg-primary/20 rounded-full animate-ping-once" />
                <div className="relative z-10 w-full h-full bg-futarchyLavender flex items-center justify-center">
                  <ApprovalIcon className="w-12 h-12" fill="#000000" />
                </div>
              </div>

              <h2 className="text-3xl font-bold mb-4 text-black">You're In!</h2>
              <p className="text-gray-600 text-lg mb-6">
                Help shape the future through the wisdom of markets.
              </p>
            </div>
            
            {/* Updated CTA button */}
            <button
              onClick={onApplyClick}
              className="w-full bg-black border border-aave-purple/30 px-6 py-4
                        text-white relative overflow-hidden group
                        transition-all duration-300
                        hover:bg-aave-purple hover:border-aave-purple/50
                        hover:shadow-[0_0_15px_rgba(182,80,158,0.3)]"
            >
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full 
                             transition-transform duration-1000 ease-in-out
                             bg-gradient-to-r from-transparent via-aave-purple-light/40 to-transparent" />
              <div className="space-y-1">
                <span className="block text-lg font-medium relative z-10">
                  Building a DAO?
                </span>
                <span className="block text-sm text-gray-300 relative z-10">
                  Be among the first companies in the world to use Futarchy for governance →
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-40">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div
        className="relative w-[480px] bg-white p-8 shadow-2xl transform-gpu 
                      hover:scale-[1.02] transition-all duration-300"
      >
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={handleClose}
            className="p-2 text-white transition-colors 
                      transform duration-300
                      w-10 h-10 flex items-center justify-center
                      hover:bg-black/5"
          >
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="white"
              stroke="currentColor"
              style={{ transform: "translateY(1px)" }}
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-8">
          <div className="text-center bg-black p-6 -mx-8 -mt-8">
            <div className="flex items-center justify-center gap-4">
              <img
                src="/assets/futarchy-logo.svg"
                alt="Futarchy Icon"
                className="h-8 invert"
              />
              <img
                src="/assets/futarchy-fi-logo.svg"
                alt="Futarchy"
                className="h-8 invert"
              />
            </div>
            <p className="text-aave-gray text-lg mt-2">
              Harnessing market wisdom to guide better decisions
            </p>
          </div>

          <div className="space-y-6">
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="Enter your email"
              className={`w-full bg-white border ${
                errors.email ? "border-red-500" : "border-gray-200"
              } px-4 py-3 text-black placeholder:text-aave-gray/50 
                focus:border-aave-purple focus:outline-none transition-colors`}
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}

            <div className="flex items-center justify-between">
              <ToggleButton
                isActive={showEthField}
                onToggle={() => setShowEthField(!showEthField)}
                text={
                  <span className="text-aave-purple">
                    Want to unlock VIP Access?
                  </span>
                }
                borderOn={true}
                customToggleClass="relative"
                toggleWrapperClass={`
                  relative
                  before:absolute before:inset-[-2px] 
                  before:bg-primary/5 before:animate-pulse-glow
                  before:blur-[1px] before:-z-10
                  after:absolute after:inset-[-1px] 
                  after:bg-gradient-to-r after:from-primary/10 after:to-transparent
                  after:animate-pulse-slow after:blur-[0.5px] after:-z-10
                `}
                size="small"
              />
            </div>

            <div
              className={`
              transition-all duration-300 
              ${
                showEthField
                  ? "opacity-100 max-h-24 py-4 mt-4"
                  : "opacity-0 max-h-0 overflow-hidden"
              }
            `}
            >
              <input
                type="text"
                value={ethAddress}
                onChange={handleEthAddressChange}
                placeholder="EVM Address (for priority waitlist access)"
                className={`w-full bg-white border ${
                  errors.ethAddress ? "border-red-500" : "border-gray-200"
                } px-4 py-3 text-black placeholder:text-aave-gray/50 
                  focus:border-aave-purple focus:outline-none transition-colors`}
              />
              {errors.ethAddress && (
                <p className="text-red-500 text-sm mt-1">{errors.ethAddress}</p>
              )}
            </div>

            <button
              onClick={handleSubmit}
              className="w-full bg-black border border-aave-purple/30 px-4 py-3
                        text-white
                        relative overflow-hidden group
                        transition-all duration-300
                        hover:bg-aave-purple hover:border-aave-purple/50
                        hover:shadow-[0_0_15px_rgba(182,80,158,0.3)]"
            >
              {/* Highlight glow effect that moves on hover */}
              <div
                className="absolute inset-0 -translate-x-full group-hover:translate-x-full 
                              transition-transform duration-1000 ease-in-out
                              bg-gradient-to-r from-transparent via-aave-purple-light/40 to-transparent"
              />

              {/* Top highlight effect */}
              <div
                className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100
                              transition-opacity duration-300
                              bg-gradient-to-r from-transparent via-white/50 to-transparent"
              />

              {/* Button text */}
              <span
                className="relative z-10 font-medium group-hover:text-white
                               transition-colors duration-300"
              >
                Get Early Access
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingModal;

// SwapPage.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import LandingModal from "./LandingModal";
import ApplicationForm from "../application/ApplicationForm";
import RootLayout from "../../layout/RootLayout";
import Link from 'next/link';

// Add this after imports, at "RIGHT HERE":
const rand = (min, max) => Math.random() * (max - min) + min;

// Dynamic import of TypewriterEffect with ssr disabled
const TypewriterEffect = dynamic(() => import("react-typewriter-effect"), {
  ssr: false,
});

const getCompaniesUrl = (useStorybookUrl = false) => {
  if (useStorybookUrl) {
    return '/?path=/story/futarchy-fi-companies-companies-page--default';
  }
  return '/companies';
};

const SwapPage = ({ useStorybookUrl = false }) => {
  const [showModal, setShowModal] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const canvasRef = useRef(null);
  const [isRobinSectionVisible, setIsRobinSectionVisible] = useState(false);
  const robinSectionRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isTextVisible, setIsTextVisible] = useState(false);

  useEffect(() => {
    // Set delay to match the completion of the Typewriter effect
    const timer = setTimeout(() => {
      setIsTextVisible(true);
    }, 3600); // Adjust delay based on Typewriter speed
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
      ctx.globalCompositeOperation = "lighter";
      setRadiusBasedOnScreenSize();
    };

    const setRadiusBasedOnScreenSize = () => {
      if (window.innerWidth < 768) {
        radius = [80, 160]; // Smaller radius for mobile
      } else {
        radius = [120, 270]; // Default radius for larger screens
      }
    };

    let radius = [100, 220];
    setRadiusBasedOnScreenSize();

    handleResize();
    window.addEventListener("resize", handleResize);

    const getBounds = () => {
      const activeArea =
        window.innerWidth >= 768
          ? document.getElementById("interactive-area-desktop")
          : document.getElementById("interactive-area-mobile");

      if (!activeArea) return null;

      const activeAreaRect = activeArea.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();

      return {
        left: activeAreaRect.left - canvasRect.left,
        right: activeAreaRect.right - canvasRect.left,
        top: activeAreaRect.top - canvasRect.top,
        bottom: activeAreaRect.bottom - canvasRect.top,
        width: activeAreaRect.width,
        height: activeAreaRect.height,
      };
    };

    const rand = (min, max) => Math.random() * (max - min) + min;

    const colors = [
      ["#002aff", "#009ff2"],
      ["#002aff", "#F28C5A"],
      ["#F28C5A", "#873dcc"],
    ];

    const count = 12;
    const blur = [40, 60];

    const mouse = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      targetX: window.innerWidth / 2,
      targetY: window.innerHeight / 2,
      isInActiveArea: false,
    };

    class Particle {
      constructor() {
        this.reset();
      }

      reset() {
        const bounds = getBounds();
        if (!bounds) return;

        this.radius = rand(radius[0], radius[1]);
        this.blur = rand(blur[0], blur[1]);
        this.x = rand(bounds.left + this.radius, bounds.right - this.radius);
        this.y = rand(bounds.top + this.radius, bounds.bottom - this.radius);
        this.colorIndex = Math.floor(rand(0, 299) / 100);
        this.colorOne = colors[this.colorIndex][0];
        this.colorTwo = colors[this.colorIndex][1];
        this.vx = rand(-1, 1) * 0.5;
        this.vy = rand(-1, 1) * 0.5;
        this.acceleration = rand(0.1, 0.2);
        this.maxSpeed = rand(3, 6);
        this.angle = rand(0, Math.PI * 2);
        this.angleSpeed = rand(0.0005, 0.001);
        this.amplitude = rand(0.5, 1.5);
        this.period = rand(100, 200);
        this.timeOffset = rand(0, 1000);
        this.baseRadius = this.radius;
        this.radiusVariation = rand(5, 15);
        this.radiusSpeed = rand(0.001, 0.002);
        this.baseBlur = this.blur;
        this.blurVariation = rand(5, 10);
        this.blurSpeed = rand(0.001, 0.002);

        // Store original position and velocity
        this.originalX = this.x;
        this.originalY = this.y;
        this.originalVx = this.vx;
        this.originalVy = this.vy;
      }

      update(time) {
        const bounds = getBounds();
        if (!bounds) return;

        if (mouse.isInActiveArea) {
          const dx = mouse.targetX - this.x;
          const dy = mouse.targetY - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const effectiveRadius = this.radius + 200;

          if (distance < effectiveRadius) {
            const force =
              (1 - distance / effectiveRadius) * this.acceleration * 0.5;
            this.vx += (dx / distance) * force;
            this.vy += (dy / distance) * force;
          }
        } else {
          // Gradual return to default movement
          this.vx += (this.originalVx - this.vx) * 0.05;
          this.vy += (this.originalVy - this.vy) * 0.05;
        }

        // Add default drift
        const driftX =
          Math.sin(time * this.angleSpeed + this.timeOffset) * this.amplitude;
        const driftY =
          Math.cos(time * this.angleSpeed + this.timeOffset) * this.amplitude;

        this.x += this.vx + driftX * 0.3;
        this.y += this.vy + driftY * 0.3;

        // Edge bounce logic
        if (
          this.x - this.radius < bounds.left ||
          this.x + this.radius > bounds.right
        ) {
          this.vx *= -0.8;
          this.x = Math.max(
            bounds.left + this.radius,
            Math.min(bounds.right - this.radius, this.x)
          );
        }
        if (
          this.y - this.radius < bounds.top ||
          this.y + this.radius > bounds.bottom
        ) {
          this.vy *= -0.8;
          this.y = Math.max(
            bounds.top + this.radius,
            Math.min(bounds.bottom - this.radius, this.y)
          );
        }

        // Smooth radius and blur variations
        this.radius =
          this.baseRadius +
          Math.sin(time * this.radiusSpeed + this.timeOffset) *
            this.radiusVariation;
        this.blur =
          this.baseBlur +
          Math.sin(time * this.blurSpeed + this.timeOffset) *
            this.blurVariation;
      }

      draw() {
        ctx.beginPath();
        const grd = ctx.createRadialGradient(
          this.x,
          this.y,
          0,
          this.x,
          this.y,
          this.radius
        );
        grd.addColorStop(0, this.colorOne);
        grd.addColorStop(1, `${this.colorTwo}00`);
        ctx.fillStyle = grd;
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const particles = Array.from({ length: count }, () => new Particle());

    const getActiveArea = () => {
      return window.innerWidth >= 768
        ? document.getElementById("interactive-area-desktop")
        : document.getElementById("interactive-area-mobile");
    };

    const handleTouchMove = (e) => {
      const touch = e.touches[0];
      const activeArea = getActiveArea();
      if (!activeArea) return;

      const activeAreaRect = activeArea.getBoundingClientRect();
      const touchX = touch.clientX - activeAreaRect.left;
      const touchY = touch.clientY - activeAreaRect.top;

      if (
        touchX >= 0 &&
        touchX <= activeAreaRect.width &&
        touchY >= 0 &&
        touchY <= activeAreaRect.height
      ) {
        mouse.isInActiveArea = true;
        const canvasRect = canvas.getBoundingClientRect();
        mouse.targetX = touch.clientX - canvasRect.left;
        mouse.targetY = touch.clientY - canvasRect.top;
      } else {
        mouse.isInActiveArea = false;
      }
    };

    const handleTouchEnd = () => {
      mouse.isInActiveArea = false;
    };

    const handleMouseMove = (e) => {
      const activeArea = getActiveArea();
      if (!activeArea) return;

      const activeAreaRect = activeArea.getBoundingClientRect();
      const mouseX = e.clientX - activeAreaRect.left;
      const mouseY = e.clientY - activeAreaRect.top;

      if (
        mouseX >= 0 &&
        mouseX <= activeAreaRect.width &&
        mouseY >= 0 &&
        mouseY <= activeAreaRect.height
      ) {
        mouse.isInActiveArea = true;
        const canvasRect = canvas.getBoundingClientRect();
        mouse.targetX = e.clientX - canvasRect.left;
        mouse.targetY = e.clientY - canvasRect.top;
      } else {
        mouse.isInActiveArea = false;
      }
    };

    const handleMouseLeave = () => {
      mouse.isInActiveArea = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);

    const handleBoundaryUpdate = () => {
      const bounds = getBounds();
      if (!bounds) return;
      particles.forEach((particle) => particle.reset());
    };

    window.addEventListener("resize", handleBoundaryUpdate);

    let animationTime = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      animationTime += 1;

      if (mouse.isInActiveArea) {
        mouse.x += (mouse.targetX - mouse.x) * 0.1;
        mouse.y += (mouse.targetY - mouse.y) * 0.1;
      }

      particles.forEach((particle) => {
        particle.update(animationTime);
        particle.draw();
      });

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", handleBoundaryUpdate);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  const cards = [
    {
      title: "Unaligned Incentives",
      description:
        "In traditional DAO voting, insiders dominate decision-making, leaving outside investors and contributors without real influence or protection.",
      pattern: "misalignment.svg",
      gradientColors: "from-[#1D4F73] via-[#000000] to-[#1D4F73]",
    },
    {
      title: "Limited Outside Participation",
      description:
        "Outside contributors lack incentives to make meaningful proposals. Most external input is limited to funding requests or partnership proposals.",
      pattern: "pattern-diamonds-2.svg",
      gradientColors: " from-[#F28C5A] via-[#000000] to-[#F28C5A]",
    },
    {
      title: "Missed Opportunities",
      description:
        "Insiders struggle to encourage wider participation, missing valuable ideas without proper evaluation mechanisms or effective reward systems.",
      pattern: "pattern-bars.svg",
      gradientColors: "from-[#3C607A] via-[#000000] to-[#3C607A]",
    },
  ];

  useEffect(() => {
    const robinObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsRobinSectionVisible(true);
          } else {
            setIsRobinSectionVisible(false);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '50px'
      }
    );

    if (robinSectionRef.current) {
      robinObserver.observe(robinSectionRef.current);
    }

    return () => {
      if (robinSectionRef.current) {
        robinObserver.disconnect();
      }
    };
  }, []);

  const handleLearnMoreClick = () => {
    setShowModal(true);
  };

  const handleApplyNowClick = () => {
    setShowApplicationForm(true);
    setShowModal(false);
  };
  return (
    <RootLayout headerConfig="landing" footerConfig="landing" useStorybookUrl={useStorybookUrl}>
      <div>
        <div>
          <div className="swap-page-wrapper w-full h-full select-none">
            <div className="w-full h-full relative">
              {/* Original background gradients */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ opacity: 0.7 }}
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-white/20 to-white/50"></div>

              {/* Main content container for desktop */}
              <div
                className="relative h-screen  md:flex-col px-16 hidden md:flex place-content-center py-20"
                id="interactive-area-desktop"
              >
                {/* Center content container */}
                <div className="select-none">
                  <div className="flex flex-col w-full gap-8">
                    <div className="flex flex-col gap-4 select-none w-full">
                      <TypewriterEffect
                        textStyle={{
                          fontFamily: "var(--font-oxanium)",
                          fontSize: "64px",
                          fontWeight: "600",
                          lineHeight: "1.2",
                          color: "#000000",
                        }}
                        startDelay={100}
                        cursorColor="transparent"
                        text="Markets know better than experts."
                        typeSpeed={35}
                      />
                      <div className="flex flex-row gap-3">
                        <TypewriterEffect
                          textStyle={{
                            fontFamily: "var(--font-oxanium)",
                            fontSize: "64px",
                            fontWeight: "600",
                            color: "#000000",
                            lineHeight: "1.2",
                          }}
                          startDelay={2000}
                          cursorColor="transparent"
                          text="It's time we let them"
                          typeSpeed={35}
                        />
                        <TypewriterEffect
                          textStyle={{
                            fontFamily: "var(--font-oxanium)",
                            fontSize: "64px",
                            fontWeight: "600",
                            color: "#6F78F2",
                            lineHeight: "1.2",
                          }}
                          startDelay={2950}
                          cursorColor="transparent"
                          text="decide."
                          typeSpeed={35}
                        />
                      </div>
                    </div>
                    {/* Gradual Appearance for Additional Text */}
                    <div
                      className={`text-[22px] font-normal text-futarchyGray11 transition-opacity duration-1000 flex flex-col gap-8 ${
                        isTextVisible ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      Empowering decision-making through the wisdom of markets,
                      beyond traditional paradigms.
                      <div className="flex gap-4">
                        <button
                          onClick={handleLearnMoreClick}
                          className="w-40 h-12 border-2 border-black bg-black px-4 py-3 rounded-xl text-base font-semibold text-white hover:bg-transparent hover:text-black transition-colors shadow-xs"
                        >
                          <div className="flex flex-row justify-between">
                            <div>Learn How</div>
                            <img
                              src="/assets/ArrowUpRight.svg"
                              alt="Arrow Up Right"
                            />
                          </div>
                        </button>
                        <Link
                          href="/company"
                          className="w-40 h-12 border-2 border-black bg-transparent px-4 py-3 rounded-xl text-base font-semibold text-black hover:bg-black hover:text-white transition-colors shadow-xs flex items-center justify-center"
                        >
                          Get Started
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main content container for mobile */}
              <div
                className="relative h-full flex flex-col px-8 py-6 md:hidden select-none"
                id="interactive-area-mobile"
              >
                {/* Logo container */}
                <div className="mb-auto select-none">
                  <Image
                    src="/assets/futarchy-logo.svg"
                    alt="Futarchy Icon"
                    width={isMobile ? 40 : 50}
                    height={isMobile ? 40 : 50}
                    priority
                  />
                  <Image
                    src="/assets/futarchy-fi-logo.svg"
                    alt="Futarchy Logo"
                    width={isMobile ? 160 : 200}
                    height={isMobile ? 40 : 50}
                    priority
                  />
                </div>

                {/* Center content container */}
                <div className="mb-auto select-none">
                  <div className="max-w-md">
                    <div className="flex flex-col gap-2 select-none">
                      {/* First line in black */}
                      <TypewriterEffect
                        textStyle={{
                          fontFamily: "var(--font-oxanium)",
                          fontSize: "57px",
                          fontWeight: "400",
                          lineHeight: "64px",
                          color: "#1F1F1F",
                          letterSpacing: "-0.0025em",
                        }}
                        startDelay={100}
                        cursorColor="transparent"
                        text="Markets know better than experts."
                        typeSpeed={70}
                      />

                      {/* Second line in orange */}
                      <TypewriterEffect
                        textStyle={{
                          fontFamily: "var(--font-oxanium)",
                          fontSize: "42px",
                          fontWeight: "400",
                          lineHeight: "1.2",
                          color: "#E68556", // Orange tone
                        }}
                        startDelay={3000} // Start after the first line finishes
                        cursorColor="transparent"
                        text="It's time we let them decide."
                        typeSpeed={70}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleLearnMoreClick}
                    className="absolute left-8 bottom-6 px-6 py-2 border border-black text-black hover:bg-black hover:text-white transition-colors"
                  >
                    Learn How →
                  </button>
                </div>
              </div>

              {/* Landing Modal */}
              {showModal && (
                <LandingModal
                  handleClose={() => setShowModal(false)}
                  onApplyClick={handleApplyNowClick}
                />
              )}

              {/* Application Form Modal */}
              {showApplicationForm && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                  <div
                    className="fixed inset-0 bg-black/75 backdrop-blur-sm"
                    onClick={() => setShowApplicationForm(false)}
                  />
                  <div className="relative min-h-screen flex items-center justify-center p-4">
                    <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-xl">
                      <button
                        onClick={() => setShowApplicationForm(false)}
                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-500 z-50"
                      >
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                      <ApplicationForm
                        onClose={() => setShowApplicationForm(false)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Black bg container with cards */}
          <div className="min-h-screen bg-black py-20 relative overflow-hidden content-center">
            {/* Square dotted line using CSS background */}
            <div className="absolute top-0 left-0 right-0 h-[16px] square-dotted-line" />

            {/* Giant watermark logo - aligned left */}
            <div className="absolute inset-0 flex items-center justify-start pointer-events-none">
              <Image
                src="/assets/futarchy-logo-white.svg"
                alt="Futarchy Watermark"
                width={600}
                height={600}
                className="opacity-[0.1] ml-16 watermark-blur"
                priority
              />
            </div>

            <div className="container mx-auto px-8 md:px-16 relative z-10">
              {/* Centered headline text */}
              <div className="mb-16 text-center">
                <h2 className="text-4xl md:text-5xl font-oxanium text-white mb-4">
                  What is the biggest challenge for DAOs?
                </h2>
                <p className="text-lg md:text-xl text-white/80 mx-auto max-w-4xl">
                  Unaligned incentives between insiders and outsiders hinder
                  participation.<br></br>
                  Insiders control votes, outsiders lack incentives, and DAOs
                  miss out on new ideas.
                </p>
              </div>

              {/* Cards content with updated gradient for first card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-4">
                {cards.map((card, index) => (
                  <div
                    key={index}
                    className="flex flex-col group relative cursor-pointer h-full rounded-xl bg-white overflow-hidden"
                  >
                    {/* Pattern/logo container in top div */}
                    <div className="bg-lightGray rounded-t-lg p-8 flex items-center justify-center h-48 relative">
                      {/* Hover gradient overlay */}
                      <div
                        className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br ${card.gradientColors} blur-xl`}
                      />
                      {/* Pattern/logo with parallax effect */}
                      <div className="relative z-10 transform transition-transform duration-300 group-hover:-translate-y-2">
                        <Image
                          src={`/assets/${card.pattern}`}
                          alt={`${card.title} pattern`}
                          width={96}
                          height={96}
                        />
                      </div>
                    </div>
                    {/* Title and description in bottom div */}
                    <div
                      className="bg-white rounded-b-lg p-8 min-h-[260px] relative -mt-6 z-20 
              transform transition-all duration-300 group-hover:-translate-y-4"
                    >
                      <h3 className="text-2xl font-semibold text-black mb-4">
                        {card.title}
                      </h3>
                      <p className="text-black text-lg">{card.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Solutions Section */}
          <div className="bg-white py-20 relative">
            {/* Dotted Grid Background */}
            <div
              className=""
              style={{
                backgroundImage: `
              radial-gradient(circle, #E5E5E5 1px, transparent 1px),
              radial-gradient(circle, #E5E5E5 1px, transparent 1px)
            `,
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0, 10px 10px",
                opacity: 0.5,
              }}
            />

            {/* Content container */}
            <div
              className="mx-auto px-8 md:px-16 relative"
              style={{ zIndex: 1 }}
            >
              <div className="flex flex-col md:flex-row gap-6">
                {/* Left side - Fixed Text */}
                <div className="md:w-1/3 md:sticky md:top-20 md:self-start">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-3xl font-oxanium text-black">
                        Meet Futarchy.fi
                      </h2>
                    </div>
                  </div>
                  <p className="text-lg text-black/80 mt-6">
                    Harnessing evaluation and reward mechanisms to replace
                    majority voting.<br></br>
                    Using markets to govern.
                  </p>
                </div>

                {/* Right side - Scrollable Cards */}
                <div className="md:w-2/3">
                  <div className="space-y-8 text-black">
                    {/* Card 1 */}
                    <div className="bg-[#F0F0FF] p-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-semibold">
                          Conditional Markets Predict Outcomes
                        </h3>
                      </div>
                      <p className="text-lg text-gray-700 mb-4">
                        Two markets estimate share prices based on proposal
                        passing or failing. Reflecting potential impacts on
                        value.
                      </p>
                      <Image
                        src="/assets/card1-logo.png"
                        alt="Conditional Markets"
                        width={300}
                        height={150}
                        className="w-full object-cover"
                      />
                    </div>

                    {/* Card 2 */}
                    <div className="bg-[#E6FFF9] p-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-semibold">
                          Investors Buy or Sell Shares Instead of Voting
                        </h3>
                      </div>
                      <p className="text-lg text-gray-700 mb-4">
                        Supporters buy shares if the proposal passes; opponents
                        sell shares if it passes. Trading actions replace
                        traditional votes.
                      </p>
                      <Image
                        src="/assets/card2-logo.png"
                        alt="Buy Sell Shares"
                        width={300}
                        height={150}
                        className="w-full object-cover"
                      />
                    </div>

                    {/* Card 3 */}
                    <div className="bg-[#E6F7FF] p-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-semibold">
                          Market Prices Reveal Proposal's Expected Impact
                        </h3>
                      </div>
                      <p className="text-lg text-gray-700 mb-4">
                        Supply and demand determine the price difference. Market
                        estimates quantify the proposal's potential effect.
                      </p>
                      <Image
                        src="/assets/card3-logo.png"
                        alt="Market Prices"
                        width={300}
                        height={150}
                        className="w-full object-cover"
                      />
                    </div>

                    {/* Card 4 */}
                    <div className="bg-[#FFF0F0] p-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-semibold">
                          Choosing What Maximize Shareholder Value
                        </h3>
                      </div>
                      <p className="text-lg text-gray-700 mb-4">
                        Markets select the option statistically increasing token
                        value. Highest predicted value outcome gets implemented.
                      </p>
                      <Image
                        src="/assets/card4-logo.png"
                        alt="Shareholder Value"
                        width={300}
                        height={150}
                        className="w-full object-cover"
                      />
                    </div>

                    {/* Card 5 */}
                    <div className="bg-[#F0F0F0] p-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-semibold">
                          From Advisory to Self-Enforcing
                        </h3>
                      </div>
                      <p className="text-lg text-gray-700 mb-4">
                        Starts as an advisory tool complementing governance. Can
                        evolve into a self-enforcing decision-making system.
                      </p>
                      <Image
                        src="/assets/card5-logo.png"
                        alt="Advisory System"
                        width={300}
                        height={150}
                        className="w-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Backed by the Best section with Robin Hanson */}
          <div ref={robinSectionRef} className="w-full relative min-h-screen">
            <div className="absolute inset-0 right-0 bg-white"></div>
            <div className="absolute inset-0 bg-gradient-to-l from-[#1D4F73]/45 to-[#1D4F73]"></div>

            <div className="relative py-8 h-screen content-center">
              <div className="flex flex-col w-full gap-8 px-[100px] max-w-[1440px] mx-auto">
                <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 justify-between">
                  <div className="flex flex-col text-center md:text-left gap-4 w-1/2">
                    <h3
                      className={`text-4xl font-bold font-oxanium text-white transition-all duration-700 ${
                        isRobinSectionVisible
                          ? "translate-y-0 opacity-100"
                          : "translate-y-4 opacity-0"
                      }`}
                    >
                      Guided by the Inventor of Futarchy
                    </h3>
                    <h4
                      className={`text-xl font-medium text-white transition-all duration-700 delay-100 ${
                        isRobinSectionVisible
                          ? "translate-y-0 opacity-100"
                          : "translate-y-4 opacity-0"
                      }`}
                    >
                      Robin Hanson - Chief Scientific Officer
                    </h4>
                    <p
                      className={`text-white/90 text-lg leading-relaxed transition-all duration-700 delay-200 ${
                        isRobinSectionVisible
                          ? "translate-y-0 opacity-100"
                          : "translate-y-4 opacity-0"
                      }`}
                    >
                      Robin Hanson created the concept of futarchy in 2000 -
                      using prediction markets for governance. As a professor at
                      George Mason University and research associate at Oxford's
                      Future of Humanity Institute, he developed the
                      foundational theory of how markets can make better
                      decisions than traditional voting or expert opinions. His
                      groundbreaking paper "Shall We Vote on Values, But Bet on
                      Beliefs?" shaped the future of organizational governance.
                    </p>
                    <div
                      className={`mt-4 text-white/80 italic transition-all duration-700 delay-300 ${
                        isRobinSectionVisible
                          ? "translate-y-0 opacity-100"
                          : "translate-y-4 opacity-0"
                      }`}
                    >
                      "To embed such markets in the core of our form of
                      government, we could 'vote on values, but bet on
                      beliefs.'"
                    </div>
                  </div>
                  <div
                    className={`flex flex-col gap-4 w-[480px] p-8 rounded-xl border border-futarchyGray4/30 text-futarchyGray4 bg-white/15 transition-all duration-1000 ease-out ${
                      isRobinSectionVisible
                        ? "translate-y-0 opacity-100"
                        : "translate-y-20 opacity-0"
                    }`}
                  >
                    <div className="text-4xl font-bold text-futarchyDarkBlue text-right">
                      2000
                    </div>
                    <div className="text-base font-medium text-white text-right">
                      Robin Hanson introduces futarchy, governance through
                      prediction markets.
                    </div>
                  </div>
                </div>
                <div
                  className={`flex flex-row gap-8 transition-all duration-1000 ease-out delay-300 ${
                    isRobinSectionVisible
                      ? "translate-y-0 opacity-100"
                      : "translate-y-20 opacity-0"
                  }`}
                >
                  <button
                    onClick={handleLearnMoreClick}
                    className="h-12 bg-black px-4 py-3 rounded-xl text-base font-semibold text-white hover:bg-white hover:text-black transition-colors shadow-xs"
                  >
                    <div className="flex flex-row justify-between">
                      <div>Get Early Access</div>
                    </div>
                  </button>
                  <button
                    onClick={handleLearnMoreClick}
                    className="h-12 bg-white px-4 py-3 rounded-xl text-base font-semibold text-black hover:bg-black hover:text-white transition-colors shadow-xs"
                  >
                    <div className="flex flex-row justify-center">
                      <div>Our Approach</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Final CTA Section */}
          <div className="bg-black pt-12 pb-24 relative">
            <div className="container px-[100px] relative z-10">
              <div className="flex flex-col items-start text-left gap-6">
                {/* Logos container */}
                <div className="flex items-center gap-4">
                  <Image
                    src="/assets/futarchy-fi-full-logo-white.svg"
                    alt="Futarchy Logo"
                    width={275}
                    height={85}
                    priority
                  />
                </div>

                {/* Updated CTA content */}
                <h2 className="text-3xl font-oxanium text-white">
                  Major events shouldn't surprise us.<br />
                  Neither should <span className="text-white">their impact.</span>
                </h2>
                <button
                  onClick={handleLearnMoreClick}
                  className="h-12 border-2 border-black hover:border-white bg-white px-4 py-3 rounded-xl text-base font-semibold text-black hover:bg-black hover:text-white transition-colors shadow-xs"
                >
                  <div className="flex flex-row justify-between">
                    <div>Start Trading Decisions</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RootLayout>
  );
};

export default SwapPage;

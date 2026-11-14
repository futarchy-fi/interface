// The animated colour field behind the landing hero: soft gradient blobs that drift inside the hero area
// and lean towards the pointer. Taken unchanged from LandingPage.jsx so both pages share one look.
// The hero must contain elements with the ids "interactive-area-desktop" and "interactive-area-mobile".
import { useEffect } from "react";

export default function useHeroGradient(canvasRef) {
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
}

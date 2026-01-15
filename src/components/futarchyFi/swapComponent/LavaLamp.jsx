import React, { useEffect, useRef } from "react";

const LavaLampCursor = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.globalCompositeOperation = "lighter";
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Utility function for random numbers
    const rand = (min, max) => Math.random() * (max - min) + min;

    // Customizable colors
    const backgroundColors = ["#000", "#000"];
    const colors = [
      ["#002aff", "#009ff2"],
      ["#0054ff", "#27e49b"],
      ["#202bc5", "#873dcc"],
    ];

    const count = 70;
    const blur = [12, 70];
    const radius = [1, 120];

    // Mouse position tracking
    const mouse = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      targetX: window.innerWidth / 2,
      targetY: window.innerHeight / 2,
    };

    // Particle class with cursor interaction
    class Particle {
      constructor() {
        this.radius = rand(radius[0], radius[1]);
        this.blur = rand(blur[0], blur[1]);
        this.x = rand(-100, canvas.width + 100);
        this.y = rand(-100, canvas.height + 100);
        this.colorIndex = Math.floor(rand(0, 299) / 100);
        this.colorOne = colors[this.colorIndex][0];
        this.colorTwo = colors[this.colorIndex][1];

        // Movement properties
        this.vx = rand(-1, 1) * 0.5;
        this.vy = rand(-1, 1) * 0.5;
        this.forcedX = 0;
        this.forcedY = 0;
        this.acceleration = rand(0.1, 0.2);
        this.maxSpeed = rand(3, 6);
      }

      update() {
        // Calculate distance to cursor
        const dx = mouse.targetX - this.x;
        const dy = mouse.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Cursor attraction force
        const cursorForce = 150; // Attraction radius
        if (distance < cursorForce) {
          const force = (1 - distance / cursorForce) * this.acceleration;
          this.forcedX = dx * force;
          this.forcedY = dy * force;
        } else {
          this.forcedX *= 0.95;
          this.forcedY *= 0.95;
        }

        // Update velocity with cursor force
        this.vx += this.forcedX;
        this.vy += this.forcedY;

        // Apply damping
        this.vx *= 0.98;
        this.vy *= 0.98;

        // Limit speed
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > this.maxSpeed) {
          this.vx = (this.vx / speed) * this.maxSpeed;
          this.vy = (this.vy / speed) * this.maxSpeed;
        }

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Bounce off walls
        if (this.x < -this.radius) this.x = canvas.width + this.radius;
        if (this.x > canvas.width + this.radius) this.x = -this.radius;
        if (this.y < -this.radius) this.y = canvas.height + this.radius;
        if (this.y > canvas.height + this.radius) this.y = -this.radius;
      }

      draw() {
        ctx.beginPath();
        ctx.filter = `blur(${this.blur}px)`;
        const grd = ctx.createLinearGradient(
          this.x - this.radius / 2,
          this.y - this.radius / 2,
          this.x + this.radius,
          this.y + this.radius
        );
        grd.addColorStop(0, this.colorOne);
        grd.addColorStop(1, this.colorTwo);
        ctx.fillStyle = grd;
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Create particles
    const particles = Array.from({ length: count }, () => new Particle());

    // Mouse movement handler with smooth tracking
    const handleMouseMove = (e) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Animation
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Smooth mouse movement
      mouse.x += (mouse.targetX - mouse.x) * 0.1;
      mouse.y += (mouse.targetY - mouse.y) * 0.1;

      // Update and draw particles
      particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.7 }}
      />
    </div>
  );
};

export default LavaLampCursor;

import React, { useEffect } from 'react';

const CompletionAnimation = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2000); // Animation duration

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="relative h-64 flex items-center justify-center">
      {/* Particle container */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full"
            style={{
              backgroundColor: ['#C3FF55', '#8EF8FC', '#00CDA1', '#AB6BFF'][i % 4],
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `
                particle-float-${i} 2s ease-out forwards,
                particle-fade 2s ease-out forwards
              `,
            }}
          />
        ))}
      </div>
      
      {/* Success message */}
      <div className="text-center z-10 animate-fade-up">
        <div className="text-4xl mb-2">🎉</div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          Transaction Complete!
        </h3>
        <p className="text-gray-500">
          Your tokens have been successfully traded
        </p>
      </div>

      <style jsx>{`
        @keyframes particle-fade {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0); }
        }
        
        ${[...Array(20)].map((_, i) => `
          @keyframes particle-float-${i} {
            0% { 
              transform: translate(0, 0) scale(1); 
            }
            100% { 
              transform: translate(
                ${(Math.random() - 0.5) * 200}px,
                ${(Math.random() - 0.5) * 200}px
              ) scale(0);
            }
          }
        `).join('\n')}
      `}</style>
    </div>
  );
};

export default CompletionAnimation; 
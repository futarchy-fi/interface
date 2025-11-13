import React, { useEffect, useState } from 'react';

const CircularProgressBar = ({
  currentProgress,
  totalProgress,
  radius = 50,         // Default value set to 50
  strokeWidth = 2      // Default value set to 2
}) => {
    const normalizedRadius = radius - strokeWidth / 2;
    const circumference = normalizedRadius * 2 * Math.PI;

    const [progress, setProgress] = useState(currentProgress);

    // Transitioning progress smoothly
    useEffect(() => {
        const progressDiff = currentProgress - progress;
        const step = progressDiff / 50; // Adjust the denominator for faster or slower transitions
        if (step !== 0) {
            const interval = setInterval(() => {
                setProgress(prevProgress => {
                    const newProgress = prevProgress + step;
                    if ((step > 0 && newProgress >= currentProgress) || (step < 0 && newProgress <= currentProgress)) {
                        clearInterval(interval);
                        return currentProgress;
                    }
                    return newProgress;
                });
            }, 20); // Control speed of transition with interval time
            return () => clearInterval(interval);
        }
    }, [currentProgress, progress]);

    const strokeDashoffset = circumference - (progress / totalProgress) * circumference;

    return (
        <svg
            height={radius * 2}
            width={radius * 2}
            className="mx-auto"
            style={{ transform: 'rotate(-90deg)' }}  // Rotate the SVG to start from the top
        >
            <circle
                fill="transparent"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference + ' ' + circumference}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
                className="stroke-[#E8E8E8] dark:stroke-[#636363B3]"
            />
            <circle
                fill="transparent"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference + ' ' + circumference}
                style={{
                    strokeDashoffset,
                    transition: 'stroke-dashoffset 0.35s ease-out',
                    strokeLinecap: 'round'
                }}
                className="animate-pulsate-color"
                r={normalizedRadius}
                cx={radius}
                cy={radius}
            />
        </svg>
    );
};

export default CircularProgressBar;

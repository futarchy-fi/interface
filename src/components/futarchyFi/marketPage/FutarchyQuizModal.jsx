import React, { useState, useEffect } from "react";

const QUESTIONS = [
  {
    question: "What is the primary purpose of a futarchy market?",
    options: [
      "To let users vote directly on outcomes",
      "To predict and decide outcomes based on trading activity",
      "To provide a stablecoin for DeFi",
      "To distribute tokens randomly"
    ],
    answer: 1
  },
  {
    question: "In futarchy, what determines if a decision crosses its execution threshold?",
    options: [
      "A random draw",
      "A vote by the protocol team",
      "Trading activity and market prices",
      "A snapshot of token holders"
    ],
    answer: 2
  },
  {
    question: "What happens after a decision is made in a futarchy market?",
    options: [
      "The market closes immediately",
      "Prices freeze and no trading is allowed",
      "The market shifts to predicting the measured outcome",
      "All users receive a refund"
    ],
    answer: 2
  },
  {
    question: "How are token payouts distributed at the end of a futarchy market?",
    options: [
      "Randomly among all traders",
      "According to the actual measured outcome",
      "Based on who traded first",
      "Equally to all participants"
    ],
    answer: 1
  },
  {
    question: "What is a key benefit of futarchy compared to simple voting?",
    options: [
      "It is faster",
      "It is more fun",
      "It aligns incentives by letting traders profit from accurate predictions",
      "It uses less gas"
    ],
    answer: 2
  }
];

export default function FutarchyQuizModal({ open, onClose }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correct, setCorrect] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSelected(null);
    setCorrect(null);
    setScore(0);
    setDone(false);
  }, [open]);

  if (!open) return null;

  const handleSelect = idx => {
    if (selected !== null && correct) return; // Only allow retry if previous was wrong
    setSelected(idx);
    const isCorrect = idx === QUESTIONS[step].answer;
    setCorrect(isCorrect);
    if (isCorrect) {
      setScore(s => s + 1);
      setTimeout(() => {
        if (step < QUESTIONS.length - 1) {
          setStep(step + 1);
          setSelected(null);
          setCorrect(null);
        } else {
          localStorage.setItem('hasCompletedFutarchyQuiz', 'true');
          if (typeof onClose === 'function') {
            setTimeout(() => onClose(), 700);
          }
        }
      }, 700);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-[2px] transition-opacity duration-300" />
      <div className="relative bg-white dark:bg-black text-black dark:text-white rounded-2xl shadow-2xl border-2 border-black dark:border-white max-w-lg w-full mx-4 p-10 animate-fadeInScale">
        {/* NO CLOSE BUTTON: Quiz is mandatory */}
        <h2 className="text-2xl font-extrabold mb-6 text-center">Futarchy Quiz</h2>
        {!done ? (
          <>
            <div className="mb-4 text-center text-lg font-semibold">Question {step + 1} of {QUESTIONS.length}</div>
            <div className="mb-8 text-center font-bold">{QUESTIONS[step].question}</div>
            <div className="space-y-4">
              {QUESTIONS[step].options.map((opt, idx) => (
                <button
                  key={idx}
                  className={`w-full px-5 py-3 rounded-lg border-2 font-medium transition-all
                    ${selected === idx
                      ? (correct === null ? '' : correct ? 'bg-green-500 border-green-700 text-white' : 'bg-red-500 border-red-700 text-white')
                      : 'bg-white dark:bg-black border-black dark:border-white text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900'}
                    ${selected !== null && QUESTIONS[step].answer === idx ? 'ring-2 ring-green-400' : ''}
                  `}
                  onClick={() => handleSelect(idx)}
                  disabled={correct === true && selected === idx}
                >
                  {opt}
                </button>
              ))}
            </div>
            {selected !== null && correct === false && (
              <div className="mt-4 text-center text-red-600 dark:text-red-400 font-semibold">Incorrect. Please try again!</div>
            )}
            {selected !== null && correct === true && (
              <div className="mt-4 text-center text-green-600 dark:text-green-400 font-semibold">Correct!</div>
            )}
          </>
        ) : null}
      </div>
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

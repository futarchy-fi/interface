import React from 'react';

const OpenModalButton = ({ onClick, text = 'Open Documentation' }) => {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-lg font-medium transition-colors bg-futarchyBlue9 hover:bg-futarchyBlue10 text-white dark:bg-futarchyBlueDark9 dark:hover:bg-futarchyBlueDark10 dark:text-futarchyGray3"
    >
      {text}
    </button>
  );
};

export default OpenModalButton;

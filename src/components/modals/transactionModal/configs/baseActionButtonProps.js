export const baseActionButtonProps = {
  confirm: {
    className: "group relative overflow-hidden w-full py-3 px-4 rounded-xl font-semibold transition-colors text-sm bg-futarchyGray2 dark:bg-futarchyDarkGray2 border-2 border-futarchyGray62 dark:border-futarchyGray112/40 text-black dark:text-white disabled:opacity-50 disabled:cursor-not-allowed",
    // Add other base properties for confirm buttons if needed
  },
  completed: {
    className: "group relative overflow-hidden w-full py-3 px-4 rounded-xl font-semibold transition-colors text-sm bg-futarchyTeal4 text-futarchyTeal11 border-2 border-futarchyTeal7 dark:bg-futarchyTeal6/50 dark:text-futarchyTeal4 dark:border-futarchyTeal6",
    children: "Completed",
    // Add other base properties for completed buttons if needed
  },
  // Add other shared button styles here, e.g., 'error', 'loading'
}; 
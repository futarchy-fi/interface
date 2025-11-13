import React, { useState } from "react";
import SwapComponent from "./SwapComponent"; // Ensure this is correct

export default {
  title: 'Futarchy Fi/Swap Component/Swap Component Modal',
  component: SwapComponent,
  parameters: {
    layout: "centered",
  },
};

const Template = (args) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State for each token type
  const [quiverToken, setQuiverToken] = useState(10);
  const [yesToken, setYesToken] = useState(40);
  const [noToken, setNoToken] = useState(30);

  return (
    <>
      <button
        className="px-6 py-3 bg-blue-500 text-white rounded-lg"
        onClick={() => setIsModalOpen(true)}
      >
        Open Swap Modal
      </button>

      <SwapComponent
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        quiverToken={quiverToken}
        yesToken={yesToken}
        noToken={noToken}
        setQuiverToken={setQuiverToken}
        setYesToken={setYesToken}
        setNoToken={setNoToken}
        {...args} // Forward Storybook args if needed
      />
    </>
  );
};

export const Default = Template.bind({});
Default.args = {};

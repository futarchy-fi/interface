export const STEPS_CONFIG = {
  BUY_YES: {
    1: {
      title: 'Add Collateral',
      substeps: [
        { id: 1, text: 'Approve Base Token' },
        { id: 2, text: 'Approve Wrapper Contract' },
        { id: 3, text: 'Split Position' },
        { id: 4, text: 'Wrap YES Position' },
        { id: 5, text: 'Wrap NO Position' }
      ]
    },
    2: {
      title: 'Swap',
      substeps: [
        { id: 1, text: 'Approve Token for Swap' },
        { id: 2, text: 'Execute Swap' }
      ]
    }
  },
  BUY_NO: {
    1: {
      title: 'Add Collateral',
      substeps: [
        { id: 1, text: 'Approve Base Token' },
        { id: 2, text: 'Approve Wrapper Contract' },
        { id: 3, text: 'Split Position' },
        { id: 4, text: 'Wrap YES Position' },
        { id: 5, text: 'Wrap NO Position' }
      ]
    },
    2: {
      title: 'Swap',
      substeps: [
        { id: 1, text: 'Approve Token for Swap' },
        { id: 2, text: 'Execute Swap' }
      ]
    }
  },
  SELL_YES: {
    1: {
      title: 'Add Collateral',
      substeps: [
        { id: 1, text: 'Approve Base Token' },
        { id: 2, text: 'Approve Wrapper Contract' },
        { id: 3, text: 'Split Position' },
        { id: 4, text: 'Wrap YES Position' },
        { id: 5, text: 'Wrap NO Position' }
      ]
    },
    2: {
      title: 'Swap',
      substeps: [
        { id: 1, text: 'Approve Token for Swap' },
        { id: 2, text: 'Execute Swap' }
      ]
    }
  },
  SELL_NO: {
    1: {
      title: 'Add Collateral',
      substeps: [
        { id: 1, text: 'Approve Base Token' },
        { id: 2, text: 'Approve Wrapper Contract' },
        { id: 3, text: 'Split Position' },
        { id: 4, text: 'Wrap YES Position' },
        { id: 5, text: 'Wrap NO Position' }
      ]
    },
    2: {
      title: 'Swap',
      substeps: [
        { id: 1, text: 'Approve Token for Swap' },
        { id: 2, text: 'Execute Swap' }
      ]
    }
  }
}; 
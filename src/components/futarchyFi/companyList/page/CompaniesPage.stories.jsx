import CompaniesPage from './CompaniesPage';

export default {
  title: 'Futarchy Fi/Companies/Companies Page',
  component: CompaniesPage,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
    },
  },
};

export const Default = {
  args: {
    useStorybookUrl: true
  }
}; 
import ProposalsPage from '@/components/futarchyFi/proposalsList/page/proposalsPage/ProposalsPage';

export default function Page({ params }) {
  return <ProposalsPage initialCompanyId={params.companyId} />;
} 
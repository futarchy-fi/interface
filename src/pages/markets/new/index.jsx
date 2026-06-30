import dynamic from 'next/dynamic';

const CreateMarketFlow = dynamic(
  () => import('../../../components/futarchyFi/createMarket/CreateMarketFlow'),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-futarchyDarkGray2">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-futarchyLavender" />
      </div>
    ),
  }
);

export default function NewMarketPage() {
  return <CreateMarketFlow />;
}

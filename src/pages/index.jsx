//Using swapPage.jsxx

import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Preserve query parameters when redirecting
    const query = router.query;
    router.push({
      pathname: '/companies',
      query: query
    });
  }, [router]);

  return null; // or you could return a loading component here if desired
}

// Add static generation
export async function getStaticProps() {
  return {
    props: {}, // will be passed to the page component as props
  };
}

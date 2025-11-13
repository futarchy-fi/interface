import React from 'react';
import Head from 'next/head';
import SupabaseComponent from '../../components/supabase/SupabaseComponent';

const SupabasePage = () => {
  return (
    <>
      <Head>
        <title>Supabase Demo | Futarchy Web</title>
        <meta name="description" content="A demonstration of Supabase integration" />
      </Head>

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Supabase Integration Demo</h1>
        <p className="mb-6">
          This page demonstrates how to connect to Supabase and retrieve data from a table.
        </p>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <SupabaseComponent />
        </div>
      </div>
    </>
  );
};

export default SupabasePage; 
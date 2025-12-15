import Companies from "../../components/futarchyFi/companyList/page/CompaniesPage";

export default function CompaniesPage() {
  return <Companies />;
}

// Add static generation
export async function getStaticProps() {
  return {
    props: {}, // will be passed to the page component as props
  };
}
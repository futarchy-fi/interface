import RefactorComponent from "../components/refactor/RefactorComponent";

export default function RefactorPage() {
  return <RefactorComponent />;
}

// Add static generation
export async function getStaticProps() {
  return {
    props: {}, // will be passed to the page component as props
  };
} 
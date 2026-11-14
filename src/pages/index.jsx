import ResearchLanding from "../components/futarchyFi/landingPage/ResearchLanding";

export default function Home() {
  return <ResearchLanding />;
}

export async function getStaticProps() {
  return {
    props: {},
  };
}

import LandingPage from "../components/futarchyFi/landingPage/LandingPage";

export default function Home() {
  return <LandingPage />;
}

export async function getStaticProps() {
  return {
    props: {},
  };
}

/**
 * Check GnosisDAO metadata in subgraph
 */

const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1719045/futarchy-complete/version/latest';

async function test() {
  console.log('Checking GnosisDAO metadata...\n');

  const query = `{
        organization(id: "0x41727e353ab437396c5f71cc8ec2f12493290263") {
            id
            name
            description
            metadata
            metadataURI
            owner
        }
    }`;

  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  const result = await response.json();

  if (result.data?.organization) {
    const org = result.data.organization;
    console.log(`✅ Organization: ${org.name}`);
    console.log(`   Address: ${org.id}`);
    console.log(`   Owner: ${org.owner}`);
    console.log(`   Description: ${org.description || '(empty)'}`);
    console.log(`   Metadata: ${org.metadata || '(empty)'}`);
    console.log(`   MetadataURI: ${org.metadataURI || '(empty)'}`);

    if (!org.metadata || org.metadata === '') {
      console.log('\n⚠️ METADATA IS EMPTY!');
      console.log('   Use the "Edit My Organizations" modal to update with:');
      console.log(`   {
     "coverImage": "https://your-image-url.png",
     "colors": { "primary": "#6b21a8" }
   }`);
    }
  } else {
    console.log('❌ Organization not found');
    console.log(JSON.stringify(result, null, 2));
  }
}

test().catch(console.error);

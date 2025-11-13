/**
 * Test script for Snapshot API integration
 * Run with: node test-snapshot-api.js
 */

const SNAPSHOT_GRAPHQL_ENDPOINT = 'https://hub.snapshot.org/graphql';
const PROPOSAL_ID = '0x40dbf611da3cb0dc1a5fd48140330e03f90214a9410ab2a25b782c1f3160eb0b';

async function testSnapshotAPI() {
  console.log('🔍 Testing Snapshot API...\n');

  const query = `
    query {
      proposal (id: "${PROPOSAL_ID}") {
        title
        space {
          id
          name
        }
        choices
        scores
        scores_total
        scores_state
        votes
        quorum
        state
      }
    }
  `;

  try {
    console.log('📡 Fetching proposal data...');
    const response = await fetch(SNAPSHOT_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    const proposal = result.data.proposal;

    console.log('\n✅ Successfully fetched Snapshot data!\n');
    console.log('📊 Proposal Details:');
    console.log('─'.repeat(80));
    console.log(`Title: ${proposal.title}`);
    console.log(`Space: ${proposal.space.name} (${proposal.space.id})`);
    console.log(`State: ${proposal.state}`);
    console.log(`Total Votes: ${proposal.votes}`);
    console.log(`Total Score: ${proposal.scores_total.toFixed(2)}`);
    console.log(`Quorum: ${proposal.quorum || 'N/A'}`);
    console.log('─'.repeat(80));

    console.log('\n📈 Voting Results:');
    console.log('─'.repeat(80));
    proposal.choices.forEach((choice, index) => {
      const score = proposal.scores[index];
      const percentage = (score / proposal.scores_total) * 100;
      const bar = '█'.repeat(Math.round(percentage / 2));
      console.log(`${choice.padEnd(15)} ${score.toFixed(2).padStart(12)} (${percentage.toFixed(1)}%) ${bar}`);
    });
    console.log('─'.repeat(80));

    // Check quorum
    if (proposal.quorum) {
      const quorumPercent = (proposal.quorum / proposal.scores_total) * 100;
      const quorumMet = proposal.scores_total >= proposal.quorum;
      console.log(`\n${quorumMet ? '✅' : '❌'} Quorum: ${quorumPercent.toFixed(1)}% ${quorumMet ? '(MET)' : '(NOT MET)'}`);
    }

    // Determine winner
    const maxIndex = proposal.scores.indexOf(Math.max(...proposal.scores));
    const winner = proposal.choices[maxIndex];
    const winnerScore = proposal.scores[maxIndex];
    const winnerPercent = (winnerScore / proposal.scores_total) * 100;

    console.log(`\n🏆 Leading Option: ${winner} (${winnerPercent.toFixed(1)}%)\n`);

    return true;
  } catch (error) {
    console.error('\n❌ Error testing Snapshot API:', error.message);
    return false;
  }
}

// Run the test
testSnapshotAPI().then(success => {
  process.exit(success ? 0 : 1);
});

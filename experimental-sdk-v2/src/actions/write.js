import chalk from 'chalk';
import ora from 'ora';

export async function createOrganization(contracts, factoryAddress, name, desc) {
    const spinner = ora('Creating Organization...').start();
    try {
        const aggregator = contracts.getAggregator(factoryAddress);
        const tx = await aggregator.createAndAddOrganizationMetadata(
            name,
            desc,
            "{}", // Empty metadata JSON
            ""    // Empty IPFS URI
        );
        spinner.text = 'Transaction sent! Waiting for confirmation...';
        const receipt = await tx.wait();
        spinner.succeed(chalk.green(`Organization Created! Hash: ${receipt.hash}`));
    } catch (error) {
        spinner.fail(chalk.red('Failed to create Organization'));
        console.error(error);
    }
}

/**
 * Organization Commands (Task 91)
 *
 * CLI commands for organization management:
 * - org list - List user's organizations
 * - org select <slug> - Set active organization
 * - org info - Show current organization details
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { listOrganizations, getOrganization } from '../lib/api.js';
import {
  getSelectedOrgId,
  getSelectedOrgSlug,
  setSelectedOrg,
  clearSelectedOrg,
  isAuthenticated,
} from '../lib/auth.js';

export function createOrgCommand(): Command {
  const org = new Command('org')
    .description('Organization management commands');

  // List organizations
  org
    .command('list')
    .alias('ls')
    .description('List your organizations')
    .action(async () => {
      if (!isAuthenticated()) {
        console.log(chalk.red('Not authenticated. Run "rfc login" first.'));
        process.exit(1);
      }

      const spinner = ora('Fetching organizations...').start();

      try {
        const orgs = await listOrganizations();
        spinner.stop();

        if (orgs.length === 0) {
          console.log(chalk.yellow('No organizations found.'));
          console.log(chalk.dim('Create one at https://app.researchflow.io'));
          return;
        }

        const selectedId = getSelectedOrgId();

        const table = new Table({
          head: [
            chalk.cyan(''),
            chalk.cyan('Name'),
            chalk.cyan('Slug'),
            chalk.cyan('Role'),
            chalk.cyan('Tier'),
          ],
          style: { head: [], border: [] },
        });

        for (const org of orgs) {
          const isSelected = org.id === selectedId;
          table.push([
            isSelected ? chalk.green('*') : '',
            org.name,
            chalk.dim(org.slug),
            org.role,
            org.subscriptionTier,
          ]);
        }

        console.log(table.toString());

        if (selectedId) {
          console.log(chalk.dim(`\n* = currently selected organization`));
        } else {
          console.log(chalk.yellow('\nNo organization selected. Use "rfc org select <slug>".'));
        }
      } catch (error: any) {
        spinner.fail('Failed to list organizations');
        console.log(chalk.red(error.message));
        process.exit(1);
      }
    });

  // Select organization
  org
    .command('select <slug>')
    .description('Select an organization to work with')
    .action(async (slug: string) => {
      if (!isAuthenticated()) {
        console.log(chalk.red('Not authenticated. Run "rfc login" first.'));
        process.exit(1);
      }

      const spinner = ora('Finding organization...').start();

      try {
        const orgs = await listOrganizations();
        const org = orgs.find((o) => o.slug === slug || o.id === slug);

        if (!org) {
          spinner.fail(`Organization "${slug}" not found`);
          console.log(chalk.dim('Run "rfc org list" to see available organizations.'));
          process.exit(1);
        }

        setSelectedOrg(org.id, org.slug);
        spinner.succeed(`Selected organization: ${chalk.green(org.name)} (${org.slug})`);
      } catch (error: any) {
        spinner.fail('Failed to select organization');
        console.log(chalk.red(error.message));
        process.exit(1);
      }
    });

  // Show current organization info
  org
    .command('info')
    .description('Show current organization details')
    .action(async () => {
      if (!isAuthenticated()) {
        console.log(chalk.red('Not authenticated. Run "rfc login" first.'));
        process.exit(1);
      }

      const orgId = getSelectedOrgId();
      const orgSlug = getSelectedOrgSlug();

      if (!orgId) {
        console.log(chalk.yellow('No organization selected.'));
        console.log(chalk.dim('Use "rfc org select <slug>" to select one.'));
        process.exit(1);
      }

      const spinner = ora('Fetching organization details...').start();

      try {
        const org = await getOrganization(orgId);
        spinner.stop();

        if (!org) {
          console.log(chalk.red('Organization not found or access denied.'));
          clearSelectedOrg();
          process.exit(1);
        }

        console.log(chalk.bold('\nOrganization Details\n'));
        console.log(`  ${chalk.dim('Name:')}        ${org.name}`);
        console.log(`  ${chalk.dim('Slug:')}        ${org.slug}`);
        console.log(`  ${chalk.dim('Description:')} ${org.description || chalk.dim('(none)')}`);
        console.log(`  ${chalk.dim('Your Role:')}   ${org.role}`);
        console.log(`  ${chalk.dim('Tier:')}        ${org.subscriptionTier}`);
        console.log();
      } catch (error: any) {
        spinner.fail('Failed to get organization details');
        console.log(chalk.red(error.message));
        process.exit(1);
      }
    });

  // Clear selection
  org
    .command('clear')
    .description('Clear the selected organization')
    .action(() => {
      clearSelectedOrg();
      console.log(chalk.green('Organization selection cleared.'));
    });

  return org;
}

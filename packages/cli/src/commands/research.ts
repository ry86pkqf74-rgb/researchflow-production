/**
 * Research Commands (Task 91)
 *
 * CLI commands for research project management:
 * - research list - List research projects
 * - research view <id> - View project details
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { listResearchProjects, getResearchProject } from '../lib/api.js';
import { isAuthenticated, getSelectedOrgSlug } from '../lib/auth.js';

export function createResearchCommand(): Command {
  const research = new Command('research')
    .description('Research project commands');

  // List research projects
  research
    .command('list')
    .alias('ls')
    .description('List research projects in the selected organization')
    .action(async () => {
      if (!isAuthenticated()) {
        console.log(chalk.red('Not authenticated. Run "rfc login" first.'));
        process.exit(1);
      }

      const orgSlug = getSelectedOrgSlug();
      if (!orgSlug) {
        console.log(chalk.yellow('No organization selected.'));
        console.log(chalk.dim('Use "rfc org select <slug>" first.'));
        process.exit(1);
      }

      const spinner = ora('Fetching research projects...').start();

      try {
        const projects = await listResearchProjects();
        spinner.stop();

        if (projects.length === 0) {
          console.log(chalk.yellow('No research projects found.'));
          return;
        }

        const table = new Table({
          head: [
            chalk.cyan('ID'),
            chalk.cyan('Title'),
            chalk.cyan('Status'),
            chalk.cyan('Created'),
          ],
          style: { head: [], border: [] },
        });

        for (const project of projects) {
          const createdDate = new Date(project.createdAt).toLocaleDateString();
          table.push([
            chalk.dim(project.id.substring(0, 8)),
            project.title,
            formatStatus(project.status),
            createdDate,
          ]);
        }

        console.log(`\n${chalk.bold(`Research Projects in ${orgSlug}`)}\n`);
        console.log(table.toString());
        console.log(chalk.dim(`\n${projects.length} project(s) found`));
      } catch (error: any) {
        spinner.fail('Failed to list research projects');
        console.log(chalk.red(error.message));
        process.exit(1);
      }
    });

  // View research project details
  research
    .command('view <id>')
    .description('View details of a research project')
    .action(async (id: string) => {
      if (!isAuthenticated()) {
        console.log(chalk.red('Not authenticated. Run "rfc login" first.'));
        process.exit(1);
      }

      const spinner = ora('Fetching project details...').start();

      try {
        const project = await getResearchProject(id);
        spinner.stop();

        if (!project) {
          console.log(chalk.red('Research project not found.'));
          process.exit(1);
        }

        console.log(chalk.bold('\nResearch Project Details\n'));
        console.log(`  ${chalk.dim('ID:')}        ${project.id}`);
        console.log(`  ${chalk.dim('Title:')}     ${project.title}`);
        console.log(`  ${chalk.dim('Status:')}    ${formatStatus(project.status)}`);
        console.log(`  ${chalk.dim('Created:')}   ${new Date(project.createdAt).toLocaleString()}`);
        console.log(`  ${chalk.dim('Updated:')}   ${new Date(project.updatedAt).toLocaleString()}`);
        console.log();

        console.log(chalk.dim('Use "rfc artifacts list ' + project.id + '" to view artifacts.'));
      } catch (error: any) {
        spinner.fail('Failed to get project details');
        console.log(chalk.red(error.message));
        process.exit(1);
      }
    });

  return research;
}

function formatStatus(status: string): string {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
    case 'IN_PROGRESS':
      return chalk.green(status);
    case 'DRAFT':
    case 'PENDING':
      return chalk.yellow(status);
    case 'COMPLETED':
    case 'APPROVED':
      return chalk.blue(status);
    case 'ARCHIVED':
    case 'CANCELLED':
      return chalk.dim(status);
    default:
      return status;
  }
}

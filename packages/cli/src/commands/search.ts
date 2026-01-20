/**
 * Search Command (Task 91)
 *
 * CLI command for searching across research artifacts:
 * - search <query> - Full-text search
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { search } from '../lib/api.js';
import { isAuthenticated, getSelectedOrgSlug } from '../lib/auth.js';

export function createSearchCommand(): Command {
  const searchCmd = new Command('search')
    .description('Search across research artifacts')
    .argument('<query>', 'Search query')
    .option('-t, --type <type>', 'Filter by type (artifact, manuscript)')
    .option('-l, --limit <number>', 'Maximum results', '20')
    .action(async (query: string, options: { type?: string; limit: string }) => {
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

      const spinner = ora(`Searching for "${query}"...`).start();

      try {
        const results = await search(query, options.type, parseInt(options.limit, 10));
        spinner.stop();

        if (results.length === 0) {
          console.log(chalk.yellow('No results found.'));
          return;
        }

        const table = new Table({
          head: [
            chalk.cyan('Type'),
            chalk.cyan('Title/Filename'),
            chalk.cyan('Match'),
            chalk.cyan('Research'),
          ],
          style: { head: [], border: [] },
          colWidths: [12, 30, 40, 15],
          wordWrap: true,
        });

        for (const result of results) {
          table.push([
            formatResultType(result.type),
            result.title || result.filename || chalk.dim('(untitled)'),
            truncate(result.snippet || result.highlight || '', 80),
            chalk.dim(result.researchId?.substring(0, 8) || '-'),
          ]);
        }

        console.log(`\n${chalk.bold(`Search Results for "${query}"`)}\n`);
        console.log(table.toString());
        console.log(chalk.dim(`\n${results.length} result(s) found`));
      } catch (error: any) {
        spinner.fail('Search failed');
        console.log(chalk.red(error.message));
        process.exit(1);
      }
    });

  return searchCmd;
}

function formatResultType(type: string): string {
  const colors: Record<string, (s: string) => string> = {
    artifact: chalk.green,
    manuscript: chalk.blue,
    research: chalk.magenta,
  };

  const colorFn = colors[type?.toLowerCase()] || chalk.white;
  return colorFn(type || 'unknown');
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

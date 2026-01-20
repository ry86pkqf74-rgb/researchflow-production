#!/usr/bin/env node
/**
 * ResearchFlow CLI (Task 91)
 *
 * Command-line interface for ResearchFlow Canvas.
 *
 * Commands:
 * - rfc login / logout / whoami
 * - rfc org list / select <slug> / info
 * - rfc research list / view <id>
 * - rfc artifacts list <research-id> / download <id>
 * - rfc search <query>
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { createOrgCommand } from './commands/org.js';
import { createResearchCommand } from './commands/research.js';
import { createArtifactsCommand } from './commands/artifacts.js';
import { createSearchCommand } from './commands/search.js';
import {
  getApiToken,
  setApiToken,
  clearApiToken,
  getApiUrl,
  setApiUrl,
  getConfigPath,
  isAuthenticated,
  getSelectedOrgSlug,
} from './lib/auth.js';
import { getCurrentUser } from './lib/api.js';

const program = new Command();

program
  .name('rfc')
  .description('ResearchFlow Canvas CLI')
  .version('1.0.0');

// Login command
program
  .command('login')
  .description('Authenticate with ResearchFlow')
  .option('--token <token>', 'API token (or set RFC_API_TOKEN env var)')
  .option('--url <url>', 'API URL (default: http://localhost:3001)')
  .action(async (options: { token?: string; url?: string }) => {
    if (options.url) {
      setApiUrl(options.url);
      console.log(chalk.dim(`API URL set to: ${options.url}`));
    }

    let token = options.token;

    if (!token) {
      const answers = await inquirer.prompt([
        {
          type: 'password',
          name: 'token',
          message: 'Enter your API token:',
          mask: '*',
        },
      ]);
      token = answers.token;
    }

    if (!token) {
      console.log(chalk.red('No token provided.'));
      process.exit(1);
    }

    setApiToken(token);

    const spinner = ora('Verifying credentials...').start();

    try {
      const user = await getCurrentUser();
      if (user) {
        spinner.succeed(`Logged in as ${chalk.green(user.email)}`);
      } else {
        spinner.warn('Token saved, but could not verify user.');
      }
    } catch (error) {
      spinner.warn('Token saved, but verification failed.');
    }
  });

// Logout command
program
  .command('logout')
  .description('Clear stored credentials')
  .action(() => {
    clearApiToken();
    console.log(chalk.green('Logged out successfully.'));
  });

// Whoami command
program
  .command('whoami')
  .description('Show current user and organization')
  .action(async () => {
    if (!isAuthenticated()) {
      console.log(chalk.yellow('Not logged in.'));
      console.log(chalk.dim('Run "rfc login" to authenticate.'));
      process.exit(1);
    }

    const spinner = ora('Fetching user info...').start();

    try {
      const user = await getCurrentUser();
      spinner.stop();

      if (user) {
        console.log(chalk.bold('\nCurrent User\n'));
        console.log(`  ${chalk.dim('Email:')} ${user.email}`);
        if (user.firstName || user.lastName) {
          console.log(`  ${chalk.dim('Name:')}  ${user.firstName || ''} ${user.lastName || ''}`.trim());
        }

        const orgSlug = getSelectedOrgSlug();
        if (orgSlug) {
          console.log(`  ${chalk.dim('Org:')}   ${orgSlug}`);
        } else {
          console.log(`  ${chalk.dim('Org:')}   ${chalk.yellow('(none selected)')}`);
        }

        console.log();
      } else {
        console.log(chalk.yellow('Could not retrieve user info.'));
      }
    } catch (error: any) {
      spinner.fail('Failed to get user info');
      console.log(chalk.red(error.message));
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show CLI configuration status')
  .action(() => {
    console.log(chalk.bold('\nResearchFlow CLI Status\n'));
    console.log(`  ${chalk.dim('Config file:')} ${getConfigPath()}`);
    console.log(`  ${chalk.dim('API URL:')}     ${getApiUrl()}`);
    console.log(`  ${chalk.dim('Logged in:')}   ${isAuthenticated() ? chalk.green('Yes') : chalk.yellow('No')}`);

    const orgSlug = getSelectedOrgSlug();
    console.log(`  ${chalk.dim('Org:')}         ${orgSlug || chalk.dim('(none)')}`);
    console.log();
  });

// Add subcommands
program.addCommand(createOrgCommand());
program.addCommand(createResearchCommand());
program.addCommand(createArtifactsCommand());
program.addCommand(createSearchCommand());

// Parse and run
program.parse();

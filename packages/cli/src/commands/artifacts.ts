/**
 * Artifacts Commands (Task 91)
 *
 * CLI commands for artifact management:
 * - artifacts list <research-id> - List artifacts for a project
 * - artifacts download <id> - Download an artifact
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import * as fs from 'fs';
import * as path from 'path';
import { listArtifacts, downloadArtifact } from '../lib/api.js';
import { isAuthenticated } from '../lib/auth.js';

export function createArtifactsCommand(): Command {
  const artifacts = new Command('artifacts')
    .description('Artifact management commands');

  // List artifacts
  artifacts
    .command('list <research-id>')
    .alias('ls')
    .description('List artifacts for a research project')
    .action(async (researchId: string) => {
      if (!isAuthenticated()) {
        console.log(chalk.red('Not authenticated. Run "rfc login" first.'));
        process.exit(1);
      }

      const spinner = ora('Fetching artifacts...').start();

      try {
        const arts = await listArtifacts(researchId);
        spinner.stop();

        if (arts.length === 0) {
          console.log(chalk.yellow('No artifacts found for this research project.'));
          return;
        }

        const table = new Table({
          head: [
            chalk.cyan('ID'),
            chalk.cyan('Type'),
            chalk.cyan('Filename'),
            chalk.cyan('Size'),
            chalk.cyan('Created'),
          ],
          style: { head: [], border: [] },
        });

        for (const art of arts) {
          const createdDate = new Date(art.createdAt).toLocaleDateString();
          table.push([
            chalk.dim(art.id.substring(0, 8)),
            formatArtifactType(art.artifactType),
            art.filename,
            formatBytes(art.sizeBytes),
            createdDate,
          ]);
        }

        console.log(`\n${chalk.bold('Artifacts')}\n`);
        console.log(table.toString());
        console.log(chalk.dim(`\n${arts.length} artifact(s) found`));
      } catch (error: any) {
        spinner.fail('Failed to list artifacts');
        console.log(chalk.red(error.message));
        process.exit(1);
      }
    });

  // Download artifact
  artifacts
    .command('download <id>')
    .alias('dl')
    .description('Download an artifact')
    .option('-o, --output <path>', 'Output file path')
    .action(async (id: string, options: { output?: string }) => {
      if (!isAuthenticated()) {
        console.log(chalk.red('Not authenticated. Run "rfc login" first.'));
        process.exit(1);
      }

      const spinner = ora('Downloading artifact...').start();

      try {
        const { content, filename } = await downloadArtifact(id);
        const outputPath = options.output || path.join(process.cwd(), filename);

        fs.writeFileSync(outputPath, content, 'utf-8');
        spinner.succeed(`Downloaded: ${chalk.green(outputPath)}`);
      } catch (error: any) {
        spinner.fail('Failed to download artifact');
        console.log(chalk.red(error.message));
        process.exit(1);
      }
    });

  return artifacts;
}

function formatArtifactType(type: string): string {
  const colors: Record<string, (s: string) => string> = {
    manuscript: chalk.blue,
    dataset: chalk.green,
    analysis: chalk.magenta,
    figure: chalk.cyan,
    table: chalk.yellow,
    supplement: chalk.gray,
  };

  const colorFn = colors[type.toLowerCase()] || chalk.white;
  return colorFn(type);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

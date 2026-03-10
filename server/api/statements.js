import path from 'path';
import { readdir, readFile } from 'fs/promises';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { applyCors } from './_cors.js';
import { parseStatementText, summarizeTransactions } from './statements-shared.js';

const STATEMENTS_DIR = path.join(process.env.HOME || '', 'Documents/Misc/statement/');
const execFileAsync = promisify(execFile);

async function readPdfText(filePath) {
  try {
    const { stdout } = await execFileAsync('pdftotext', [filePath, '-'], { maxBuffer: 10 * 1024 * 1024 });
    if (stdout?.trim()) return stdout;
  } catch {
    // Fall through to pdf-parse below.
  }

  const buffer = await readFile(filePath);
  const { default: pdfParse } = await import('pdf-parse');
  const parsed = await pdfParse(buffer);
  return parsed?.text || '';
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method !== 'GET') {
    return res.status(405).json({ statements: [] });
  }

  try {
    const entries = await readdir(STATEMENTS_DIR, { withFileTypes: true });
    const pdfFiles = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
    const requested = typeof req.query?.filename === 'string' ? req.query.filename : '';
    const selectedFiles = requested ? pdfFiles.filter((filename) => filename === requested) : pdfFiles;

    const statements = await Promise.all(
      selectedFiles.map(async (filename) => {
        try {
          const filePath = path.join(STATEMENTS_DIR, filename);
          const text = await readPdfText(filePath);
          const transactions = parseStatementText(text);
          const spendingMonth = summarizeTransactions(transactions, filename);

          return { filename, transactions, spendingMonth };
        } catch {
          return { filename, transactions: [], spendingMonth: null };
        }
      })
    );

    return res.status(200).json({ statements });
  } catch {
    return res.status(200).json({ statements: [] });
  }
}

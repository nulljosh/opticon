import path from 'path';
import { access, readdir, readFile } from 'fs/promises';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { parseStatementText, summarizeTransactions } from './statements-shared.js';

const execFileAsync = promisify(execFile);
const DEFAULT_STATEMENTS_DIR = path.join(process.env.HOME || '', 'Documents/Misc/statement/');

export async function readPdfText(filePath) {
  try {
    const { stdout } = await execFileAsync('pdftotext', [filePath, '-'], { maxBuffer: 10 * 1024 * 1024 });
    if (stdout?.trim()) return stdout;
  } catch {
    // Fall through to pdf-parse below.
  }

  const buffer = await readFile(filePath);
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result?.text || '';
  } catch (err) {
    console.warn(`[PDF] Failed to parse ${filePath}: ${err.message}`);
    return '';
  } finally {
    await parser.destroy();
  }
}

export async function summarizeStatementBuffer(buffer, filename) {
  let text = '';
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      text = result?.text || '';
    } finally {
      await parser.destroy();
    }
  } catch (err) {
    console.warn(`[PDF] Failed to parse ${filename}: ${err.message}`);
    return { transactions: [], spendingMonth: null };
  }
  const transactions = parseStatementText(text);
  return {
    transactions,
    spendingMonth: summarizeTransactions(transactions, filename),
  };
}

export async function listStatements({ filename, statementsDir = DEFAULT_STATEMENTS_DIR } = {}) {
  const entries = await readdir(statementsDir, { withFileTypes: true });
  const pdfFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  const selectedFiles = filename ? pdfFiles.filter((name) => name === filename) : pdfFiles;

  return Promise.all(
    selectedFiles.map(async (name) => {
      try {
        const filePath = path.join(statementsDir, name);
        const text = await readPdfText(filePath);
        const transactions = parseStatementText(text);
        const spendingMonth = summarizeTransactions(transactions, name);
        return { filename: name, transactions, spendingMonth };
      } catch {
        return { filename: name, transactions: [], spendingMonth: null };
      }
    })
  );
}

export async function getStatementsPayload({ filename, statementsDir = DEFAULT_STATEMENTS_DIR } = {}) {
  try {
    await access(statementsDir);
    const statements = await listStatements({ filename, statementsDir });
    return {
      exists: true,
      path: statementsDir,
      statements,
    };
  } catch {
    return {
      exists: false,
      path: statementsDir,
      statements: [],
    };
  }
}

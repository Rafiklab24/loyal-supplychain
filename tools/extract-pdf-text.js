#!/usr/bin/env node
/**
 * Simple PDF text extraction script
 * Uses pdftotext from poppler-utils
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

async function extractPdfText(pdfPath) {
  try {
    // Use pdftotext to extract text
    const command = `pdftotext "${pdfPath}" -`;
    const { stdout } = await execAsync(command);
    return stdout;
  } catch (error) {
    // If pdftotext fails, try alternative methods
    if (error.message?.includes('pdftotext') || error.code === 'ENOENT') {
      throw new Error(
        'pdftotext not found. Please install poppler-utils:\n' +
        '  macOS: brew install poppler\n' +
        '  Ubuntu/Debian: sudo apt-get install poppler-utils'
      );
    }
    throw error;
  }
}

// Main execution
if (require.main === module) {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error('Usage: node extract-pdf-text.js <pdf-file>');
    process.exit(1);
  }

  extractPdfText(pdfPath)
    .then(text => {
      console.log(text);
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

module.exports = { extractPdfText };




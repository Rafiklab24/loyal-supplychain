/**
 * PDF Generation Utility
 * Uses html2canvas and jsPDF to generate PDFs from HTML elements
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface PDFOptions {
  filename?: string;
  format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margin?: number;
  quality?: number;
}

const defaultOptions: PDFOptions = {
  filename: 'document.pdf',
  format: 'a4',
  orientation: 'portrait',
  margin: 10,
  quality: 2,
};

/**
 * Generate PDF from an HTML element
 */
export async function generatePDF(
  element: HTMLElement,
  options: PDFOptions = {}
): Promise<Blob> {
  const opts = { ...defaultOptions, ...options };

  // Capture the element as canvas with improved settings
  const canvas = await html2canvas(element, {
    scale: opts.quality || 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    // Important: these settings help with proper rendering
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    x: 0,
    y: 0,
    scrollX: 0,
    scrollY: 0,
    // Ignore elements that might cause issues
    ignoreElements: (el) => {
      return el.classList?.contains('no-pdf');
    },
  });

  // Calculate dimensions
  const imgWidth = opts.format === 'a4' ? 210 : 215.9; // mm
  const pageHeight = opts.format === 'a4' ? 297 : 279.4; // mm

  // Create PDF
  const pdf = new jsPDF({
    orientation: opts.orientation,
    unit: 'mm',
    format: opts.format,
  });

  // Add margin
  const margin = opts.margin || 0;
  const contentWidth = imgWidth - (margin * 2);
  const contentHeight = (canvas.height * contentWidth) / canvas.width;

  // Handle multiple pages if content is too long
  let heightLeft = contentHeight;
  let position = margin;
  const imgData = canvas.toDataURL('image/png');

  // Add first page
  pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
  heightLeft -= (pageHeight - margin * 2);

  // Add additional pages if needed
  while (heightLeft > 0) {
    position = heightLeft - contentHeight + margin;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
    heightLeft -= (pageHeight - margin * 2);
  }

  // Return as blob
  return pdf.output('blob');
}

/**
 * Download PDF from an HTML element
 */
export async function downloadPDF(
  element: HTMLElement,
  options: PDFOptions = {}
): Promise<void> {
  const blob = await generatePDF(element, options);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = options.filename || 'document.pdf';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Print an HTML element
 */
export function printElement(element: HTMLElement): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Failed to open print window');
    return;
  }

  // Get all stylesheets
  const styleSheets = Array.from(document.styleSheets)
    .map((styleSheet) => {
      try {
        return Array.from(styleSheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n');
      } catch {
        // Cross-origin stylesheets will throw
        if (styleSheet.href) {
          return `@import url("${styleSheet.href}");`;
        }
        return '';
      }
    })
    .join('\n');

  // Write the print document
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Invoice</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          ${styleSheets}
          
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            @page {
              size: A4;
              margin: 0;
            }
          }
          
          body {
            font-family: 'Cairo', 'Inter', sans-serif;
            margin: 0;
            padding: 0;
          }
        </style>
      </head>
      <body>
        ${element.outerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();
  
  // Wait for content to load then print
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };
}


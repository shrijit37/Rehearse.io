import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

/**
 * Extracts raw text from a Base64 encoded PDF string.
 * @param {string} base64String - Base64 encoded PDF data (with or without data URL prefix)
 * @returns {Promise<string>} - The parsed text content of the PDF
 */
export const extractTextFromBase64Pdf = async (base64String) => {
  if (!base64String) {
    throw new Error("No PDF data provided");
  }

  // Clean data URL scheme prefix if present
  const base64Data = base64String.replace(/^data:application\/pdf;base64,/, "");

  const buffer = Buffer.from(base64Data, "base64");
  const data = await pdfParse(buffer);
  return data.text;
};

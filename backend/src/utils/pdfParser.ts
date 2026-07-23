import { PDFParse } from "pdf-parse";

/**
 * Extracts raw text from a Base64 encoded PDF string.
 * @param base64String Base64 encoded PDF data (with or without data URL prefix)
 */
export async function extractTextFromBase64Pdf(base64String: string): Promise<string> {
    if (!base64String) {
        throw new Error("No PDF data provided");
    }

    // Strip any data URL scheme prefix (e.g. "data:application/pdf;base64,")
    const base64Data = base64String
        .replace(/^data:application\/pdf;base64,/, "")
        .replace(/^data:.*;base64,/, "");

    const buffer = Buffer.from(base64Data, "base64");
    const parser = new PDFParse({ data: buffer });
    try {
        const textResult = await parser.getText();
        return textResult.text;
    } finally {
        await parser.destroy();
    }
}
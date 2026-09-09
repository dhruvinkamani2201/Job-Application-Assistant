export async function extractResumeText(buffer: Buffer, fileType: "pdf" | "docx"): Promise<string> {
  if (fileType === "pdf") {
    // pdf-parse has no types; require() avoids bundling issues in the route.
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return result.text.trim();
  }

  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

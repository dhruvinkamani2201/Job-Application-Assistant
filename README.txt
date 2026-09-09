PATCH: replace the PDF parser

1. Replace:
   app/api/resumes/upload/route.ts
   with route.ts from this patch folder.

2. In package.json:
   - remove pdf-parse
   - add pdfjs-dist: 6.3.289

3. From the project root, run:
   npm uninstall pdf-parse
   npm install pdfjs-dist@6.3.289

4. Remove generated dependencies/cache if necessary:
   Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

5. Restart:
   npm run dev

This patch keeps DOCX parsing with mammoth and switches PDF extraction to PDF.js loaded inside the request handler.

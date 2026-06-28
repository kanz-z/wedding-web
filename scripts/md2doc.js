const fs = require("fs");
const path = require("path");
const md = require("markdown-it")();

const mdContent = fs.readFileSync(
  path.join(__dirname, "..", "PROJECT_DOCUMENTATION.md"),
  "utf-8"
);

const htmlBody = md.render(mdContent);

const docHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Markdown to DOC">
<title>Proyek: Wedding Digital Invitation — Reza & Ashila</title>
<style>
  body {
    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    max-width: 1000px;
    margin: 2cm auto;
    padding: 0 20px;
    color: #1a1a1a;
  }
  h1 { font-size: 20pt; color: #c0392b; border-bottom: 2px solid #c0392b; padding-bottom: 6px; margin-top: 28px; }
  h2 { font-size: 16pt; color: #e74c3c; border-bottom: 1px solid #e74c3c; padding-bottom: 4px; margin-top: 24px; }
  h3 { font-size: 13pt; color: #2c3e50; margin-top: 20px; }
  h4 { font-size: 11pt; color: #34495e; margin-top: 16px; }
  p { margin: 6px 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt; }
  th, td { border: 1px solid #999; padding: 5px 8px; text-align: left; }
  th { background: #f2f2f2; font-weight: bold; }
  tr:nth-child(even) { background: #fafafa; }
  code { font-family: 'Consolas', 'Courier New', monospace; font-size: 9.5pt; background: #f5f5f5; padding: 1px 4px; border-radius: 3px; }
  pre { background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px; padding: 10px; font-size: 9pt; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 4px solid #e74c3c; margin: 10px 0; padding: 6px 14px; background: #fdf2f2; }
  ul, ol { margin: 6px 0; padding-left: 24px; }
  li { margin: 3px 0; }
  hr { border: none; border-top: 1px solid #ccc; margin: 20px 0; }
  strong { color: #2c3e50; }
  em { color: #7f8c8d; }
  .mermaid { display: none; }
</style>
</head>
<body>
${htmlBody}
</body>
</html>`;

const outPath = path.join(__dirname, "..", "PROJECT_DOCUMENTATION.doc");
fs.writeFileSync(outPath, docHtml, "utf-8");
console.log("DOC file created: " + outPath);

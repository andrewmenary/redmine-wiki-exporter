// fix-links.js
// This script processes markdown files in the output directory
// to fix links according to Redmine wiki export conventions.
// It converts Redmine wiki link syntax to standard markdown links,
// and adjusts links to attachments and images to point to local files.
// Usage: node fix-links.js

const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, 'output');

// Read configuration to get the Redmine URL
const CONFIG_FILE = 'config.json';
let redmineUrl = 'https://www.redmine.org'; // Default fallback
try {
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  if (config.redmineUrl) {
    redmineUrl = config.redmineUrl;
    // Remove trailing slash if present
    if (redmineUrl.endsWith('/')) {
      redmineUrl = redmineUrl.slice(0, -1);
    }
  }
} catch (e) {
  console.log('Warning: Could not read config.json, using default URL');
}

// Escape special regex characters in URL
const escapedUrl = redmineUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function processMarkdownFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Get the current project folder (parent of the markdown file)
  const currentProject = path.basename(path.dirname(filePath));

  // Convert Redmine wiki link syntax [[Page Name]] to markdown [Page Name](Page_Name.md)
  content = content.replace(/\[\[([^\]]+)\]\]/g, (match, pageName) => {
    // Check if it's a cross-project link: [[project:page]]
    if (pageName.includes(':')) {
      const [project, page] = pageName.split(':', 2);
      const pageFile = page.replace(/\s+/g, '_');
      return `[${page}](../${project}/${pageFile}.md)`;
    } else {
      // Local page link
      const pageFile = pageName.replace(/\s+/g, '_');
      return `[${pageName}](${pageFile}.md)`;
    }
  });

  // Fix wiki page links
  const wikiLinkRegex = new RegExp(
    `(\\[.*?\\])\\(${escapedUrl}\\/projects\\/([^\\/]+)\\/wiki\\/([^)#?]+)(#[^)]+)?\\)`,
    'g'
  );
  content = content.replace(wikiLinkRegex,
    (match, text, linkProject, page, anchor) => {
      // Build relative path based on whether it's same project or different
      let rel;
      if (linkProject === currentProject) {
        // Same project - just reference the page
        rel = `${page}.md`;
      } else {
        // Different project - go up one level and into the other project
        rel = `../${linkProject}/${page}.md`;
      }

      if (anchor) rel += anchor;
      return `${text}(${rel})`;
    }
  );

  // Fix image/attachment links
  const projectDir = path.dirname(filePath);
  const localAttachmentsDir = path.join(projectDir, 'attachments');

  const attachmentLinkRegex = new RegExp(
    `(!\\[.*?\\])\\(${escapedUrl}\\/attachments\\/(?:download\\/)?(\\d+)\\/([^)]+)\\)`,
    'g'
  );
  content = content.replace(attachmentLinkRegex,
    (match, text, id, filename) => {
      // URL decode the filename to handle %20 and other encoded characters
      const decodedFilename = decodeURIComponent(filename);

      // Check if file exists in local attachments folder
      const localPath = path.join(localAttachmentsDir, decodedFilename);
      if (fs.existsSync(localPath)) {
        return `${text}(attachments/${encodeURIComponent(decodedFilename)})`;
      } else {
        // File not in local attachments - search other project folders
        const parentDir = path.dirname(projectDir);
        const projects = fs.readdirSync(parentDir).filter(p => {
          const fullPath = path.join(parentDir, p);
          return fs.statSync(fullPath).isDirectory();
        });

        for (const proj of projects) {
          const otherAttachmentsDir = path.join(parentDir, proj, 'attachments');
          const otherPath = path.join(otherAttachmentsDir, decodedFilename);
          if (fs.existsSync(otherPath)) {
            return `${text}(../${proj}/attachments/${encodeURIComponent(decodedFilename)})`;
          }
        }

        // File not found anywhere - keep original URL
        console.log(`Warning: Attachment not found: ${decodedFilename} (referenced in ${filePath})`);
        return match;
      }
    }
  );

  fs.writeFileSync(filePath, content, 'utf8');
}

function walkDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith('.md')) {
      processMarkdownFile(fullPath);
    }
  });
}

walkDir(outputDir);
console.log('Markdown links updated!');

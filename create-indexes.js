// create-indexes.js
// This script creates Index.md files for each project directory
// and a top-level Index.md file listing all projects.
// It attempts to find the best candidate wiki page for each project
// to use as the index, based on the project name and common naming conventions.
// If no suitable candidate is found, it creates a basic index listing all pages.
// Usage: node create-indexes.js

const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, 'output');

// Load project metadata created by main.js
let projectMetadata = {};
try {
  const metadata = JSON.parse(fs.readFileSync(path.join(outputDir, 'projects-metadata.json'), 'utf8'));
  metadata.forEach(p => {
    projectMetadata[p.identifier] = p.name;
  });
  console.log(`Loaded metadata for ${metadata.length} projects`);
} catch (e) {
  console.log('Warning: Could not load projects-metadata.json, using identifiers as names');
}

// Find the best candidate for an index file in a project directory
function findIndexCandidate(projectDir, projectName) {
  const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.md'));

  // Generate variations of the project name
  const variations = [
    'Wiki.md',
    'Index.md',
    `${projectName}.md`,                          // Exact name
    `${projectName.replace(/\s+/g, '_')}.md`,     // Spaces to underscores
    `${projectName.replace(/\s+/g, '-')}.md`,     // Spaces to hyphens
    `${projectName.replace(/\s+/g, '')}.md`,      // Remove all spaces
  ];

  // Check each variation (case-sensitive first)
  for (const candidate of variations) {
    if (files.includes(candidate)) {
      return candidate;
    }
  }

  // Case-insensitive search
  const variationsLower = variations.map(v => v.toLowerCase());
  for (const file of files) {
    if (variationsLower.includes(file.toLowerCase())) {
      return file;
    }
  }

  // Partial match search (case-insensitive)
  const projectNameLower = projectName.toLowerCase();
  const nameVariations = [
    projectNameLower.replace(/\s+/g, ''),
    projectNameLower.replace(/\s+/g, '_'),
    projectNameLower.replace(/\s+/g, '-')
  ];
  
  for (const file of files) {
    const fileLower = file.toLowerCase().replace('.md', '');
    for (const nameVar of nameVariations) {
      if (fileLower === nameVar || fileLower.includes(nameVar)) {
        return file;
      }
    }
  }

  // If nothing found, return the first markdown file (if any)
  return files.length > 0 ? files[0] : null;
}

// Create Index.md in each project folder
function createProjectIndexes() {
  const projectDirs = fs.readdirSync(outputDir).filter(item => {
    const fullPath = path.join(outputDir, item);
    return fs.statSync(fullPath).isDirectory();
  });

  const projectList = [];

  projectDirs.forEach(projectId => {
    const projectDir = path.join(outputDir, projectId);
    const indexPath = path.join(projectDir, 'Index.md');
    
    // Get the project name from metadata, or use identifier as fallback
    const projectName = projectMetadata[projectId] || projectId;

    // Try to find the best index candidate using the project name
    const candidate = findIndexCandidate(projectDir, projectName);

    if (candidate && candidate !== 'Index.md') {
      // Copy or link to the candidate file
      const candidatePath = path.join(projectDir, candidate);
      const candidateContent = fs.readFileSync(candidatePath, 'utf8');
      fs.writeFileSync(indexPath, candidateContent, 'utf8');
      console.log(`Created Index.md for ${projectId} (using ${candidate})`);
    } else if (candidate === 'Index.md') {
      console.log(`Index.md already exists for ${projectId}`);
    } else {
      // No candidate found, create a basic index
      const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.md'));
      let content = `# ${projectName}\n\n## Pages\n\n`;
      files.forEach(file => {
        const name = file.replace('.md', '');
        content += `- [${name}](${file})\n`;
      });
      fs.writeFileSync(indexPath, content, 'utf8');
      console.log(`Created basic Index.md for ${projectId} (no wiki page found)`);
    }

    projectList.push({ id: projectId, name: projectName });
  });

  return projectList;
}

// Create top-level Index.md
function createMainIndex(projectList) {
  let content = `# Redmine Wiki Export\n\n`;
  content += `This site contains exported wiki pages from Redmine.\n\n`;
  content += `## Projects\n\n`;

  projectList.sort((a, b) => a.name.localeCompare(b.name));

  projectList.forEach(project => {
    content += `- [${project.name}](${project.id}/Index.md)\n`;
  });

  const mainIndexPath = path.join(outputDir, 'Index.md');
  fs.writeFileSync(mainIndexPath, content, 'utf8');
  console.log(`Created main Index.md with ${projectList.length} projects`);
}

// Run the index creation
console.log('Creating index files...');
const projectList = createProjectIndexes();
createMainIndex(projectList);
console.log('Index creation complete!');

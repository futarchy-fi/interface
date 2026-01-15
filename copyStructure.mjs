import fs from 'fs';
import path from 'path';
import ignore from 'ignore';

// Parse command-line arguments
const args = process.argv.slice(2);
const structureOnly = args.includes('--structure-only');
const requestOnly = args.includes('--request-only');

const rootDir = './components/questCards'; // Change this to the root directory of your application
const fileTypes = ['.js', '.jsx']; // Specify the file types you want to include
const maxFilesPerOutput = 10000; // Specify the max number of files per output file
const outputDir = './output'; // Directory where the output files will be saved
const requestFilePath = './request.txt'; // Path to the request file

// Custom ignore list
const customIgnore = [
  'public/*', // Example of a custom folder to ignore
  'src/charting_library/*' // Add more custom rules as needed
];

// Initialize the ignore instance
const ig = ignore();

// Load .gitignore file and add rules to the ignore instance
if (fs.existsSync(path.join(rootDir, '.gitignore'))) {
  const gitignoreContent = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf-8');
  ig.add(gitignoreContent);
}

// Add custom ignore rules
ig.add(customIgnore);

// Function to recursively traverse the directory and collect files
function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const relativePath = path.relative(rootDir, filePath);

    // Skip ignored files and directories
    if (ig.ignores(relativePath)) {
      return;
    }

    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getFiles(filePath, fileList);
    } else if (fileTypes.includes(path.extname(file))) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Function to read and parse the request file
function getRequestedFiles(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Request file not found: ${filePath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return fileContent.split('\n').map(line => line.trim()).filter(line => line !== '');
}

// Function to save the file content to the output directory
function saveFiles(files) {
  let fileIndex = 0;
  let fileCount = 0;
  let outputContent = '';

  files.forEach((file, index) => {
    const relativePath = path.relative(rootDir, file);
    outputContent += `${relativePath}\n\n`;

    if (!structureOnly) {
      const fileContent = fs.readFileSync(file, 'utf-8');
      outputContent += `[Code Below]\n\n${fileContent}\n\n===\n\n`;
    }

    fileCount++;

    if (fileCount === maxFilesPerOutput || index === files.length - 1) {
      const filePrefix = structureOnly ? 'output_structure_' : 'output_code_';
      fs.writeFileSync(path.join(outputDir, `${filePrefix}${fileIndex + 1}.txt`), outputContent);
      fileIndex++;
      fileCount = 0;
      outputContent = '';
    }
  });
}

// Function to clear the output directory
function clearOutputDir(dir) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(file => {
      const curPath = path.join(dir, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        clearOutputDir(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
  }
}

// Ensure the output directory exists and clear it
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
} else {
  clearOutputDir(outputDir);
}

let allFiles = [];
if (requestOnly) {
  // Get files listed in the request file
  const requestedFiles = getRequestedFiles(requestFilePath);
  allFiles = requestedFiles.filter(file => fs.existsSync(file)).map(file => path.resolve(file));
} else {
  // Get all files of specified types
  allFiles = getFiles(rootDir);
}

// Save the files to the output directory
saveFiles(allFiles);

console.log(`Files have been copied and saved in ${outputDir}`);

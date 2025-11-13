const fs = require('fs');

// Read the original file
const original = fs.readFileSync('examples/futarchy-complete.js', 'utf8');

// Read the fixed function
const fixedFunction = fs.readFileSync('examples/swap-tokens-fixed.js', 'utf8');

// Find the start and end of swapTokens function
const startIndex = original.indexOf('    async swapTokens() {');
if (startIndex === -1) {
    console.error('Could not find swapTokens function');
    process.exit(1);
}

// Find the end of the function - look for the closing brace at the same indentation level
let braceCount = 0;
let inFunction = false;
let endIndex = -1;

for (let i = startIndex; i < original.length; i++) {
    if (original[i] === '{') {
        braceCount++;
        inFunction = true;
    } else if (original[i] === '}') {
        braceCount--;
        if (inFunction && braceCount === 0) {
            // Found the closing brace
            endIndex = i + 1;
            break;
        }
    }
}

if (endIndex === -1) {
    console.error('Could not find end of swapTokens function');
    process.exit(1);
}

// Replace the function
const before = original.substring(0, startIndex);
const after = original.substring(endIndex);
const fixed = before + fixedFunction + after;

// Write the fixed file
fs.writeFileSync('examples/futarchy-complete.js', fixed);
console.log('✅ Fixed swapTokens function');
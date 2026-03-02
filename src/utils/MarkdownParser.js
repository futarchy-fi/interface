function customMarkdownParser(markdownText) {
    // Split the Markdown text into lines
    const lines = markdownText.trim().split('\n').filter(line => line.trim() !== ''); // Remove blank lines
    const metrics = [];
  
    // Process paired lines for key metrics
    for (let i = 0; i < lines.length; i += 2) {
      const boldLine = lines[i]?.trim();
      const italicLine = lines[i + 1]?.trim();
  
      // Extract color from the custom tag (e.g., {color:futarchyPurple})
      const colorMatch = boldLine.match(/\{color:([a-zA-Z]+)\}$/);
      const colorClass = colorMatch ? colorMatch[1] : 'futarchyPurple'; // Default to futarchyPurple if no color is provided
      const value = boldLine.replace(/\*\*/g, '').replace(/\{color:[a-zA-Z]+\}$/, ''); // Remove ** and color tag
      const description = italicLine.slice(1, -1); // Remove * for italics
  
      // Determine the secondary gradient color
      let gradientTo;
      switch (colorClass) {
        case 'futarchyPurple':
          gradientTo = 'futarchyBlue';
          break;
        case 'futarchyGreen':
          gradientTo = 'futarchyYellow';
          break;
        case 'futarchyOrange':
          gradientTo = 'futarchyRed';
          break;
        default:
          gradientTo = 'futarchyBlue'; // Default fallback
      }
  
      metrics.push(`
        <div class="bg-gradient-to-br from-${colorClass}/25 to-${gradientTo}/25 p-6 rounded-xl">
          <div class="text-3xl font-bold text-${colorClass} mb-2">${value}</div>
          <div class="text-sm text-gray-600">${description}</div>
        </div>
      `);
    }
  
    // Wrap the metrics in a grid container
    return `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        ${metrics.join('\n')}
      </div>
    `;
  }
  
  // Example usage
  const markdownMetrics = `
  **45%** {color:futarchyPurple}
  *Gas Optimization*
  
  **2x** {color:futarchyGreen}
  *Transaction Speed*
  
  **100%** {color:futarchyOrange}
  *ERC Standards Support*
  `;
  
  const html = customMarkdownParser(markdownMetrics);
  console.log(html);
  
  export default customMarkdownParser;
  
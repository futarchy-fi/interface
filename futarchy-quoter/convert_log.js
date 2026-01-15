const fs = require('fs');
const content = fs.readFileSync('deploy_result_test11_v4.txt', 'utf8'); // node reads mostly utf8 by default or tries detection
fs.writeFileSync('deploy_result_test11_v4_clean.txt', content, 'utf8');
console.log('Converted');

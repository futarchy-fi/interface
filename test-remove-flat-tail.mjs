// Test the removeFlatTail logic

const removeFlatTail = (data, maxDuplicates = 100) => {
  if (!data || data.length === 0) return data;

  let duplicateCount = 1;
  let lastPrice = data[data.length - 1].price;
  let flatStartIndex = data.length - 1;

  console.log(`Starting from end: price=${lastPrice}, index=${data.length - 1}`);

  // Iterate backwards from the end
  for (let i = data.length - 2; i >= 0; i--) {
    if (Math.abs(data[i].price - lastPrice) < 0.0001) {
      // Still in flat period
      duplicateCount++;
      flatStartIndex = i;
    } else {
      // Price changed - check if we found a significant flat period
      if (duplicateCount > maxDuplicates) {
        console.log(`Found ${duplicateCount} flat candles starting at index ${flatStartIndex}, truncating there`);
        return data.slice(0, flatStartIndex);
      }
      // Not enough duplicates yet, reset counter
      duplicateCount = 1;
      lastPrice = data[i].price;
      flatStartIndex = data.length - 1;
    }
  }

  // Check at the end if the entire dataset is flat
  if (duplicateCount > maxDuplicates) {
    console.log(`Entire dataset is flat (${duplicateCount} candles)`);
    return [];
  }

  console.log('No significant flat period found');
  return data;
};

// Simulate data: 165 active candles, then 1254 flat candles
const testData = [];

// Active period: prices vary
for (let i = 0; i < 165; i++) {
  testData.push({
    timestamp: 1000 + i * 3600,
    price: 0.02 + Math.random() * 0.01 // Prices vary between 0.02-0.03
  });
}

// Flat period: same price
for (let i = 0; i < 1254; i++) {
  testData.push({
    timestamp: 1000 + (165 + i) * 3600,
    price: 0.028322637666853615 // Fixed price
  });
}

console.log(`Total candles: ${testData.length}`);
console.log(`Active: 0-164 (165 candles)`);
console.log(`Flat: 165-1418 (1254 candles)\n`);

const filtered = removeFlatTail(testData, 100);

console.log(`\nAfter filtering: ${filtered.length} candles`);
console.log(`Removed: ${testData.length - filtered.length} candles`);
console.log(`Last candle price: ${filtered[filtered.length - 1].price}`);

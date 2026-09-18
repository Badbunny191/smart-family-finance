/**
 * Performance Benchmark Script for Smart Family Finance
 * 
 * Usage:
 * 1. Login to the app in browser
 * 2. Copy session cookie from DevTools
 * 3. Run: node benchmark.js --cookie "your_cookie_value"
 * 
 * Or open in browser console and run directly
 */

// Configuration
const API_BASE = 'https://smart-family-finance-test.hrmsao.workers.dev';
const DATE_FROM = '2025-03-18T00:00:00Z';
const DATE_TO = '2026-09-18T23:59:59Z';

async function benchmarkQuery(name, url, cookie) {
  const start = performance.now();
  
  try {
    const response = await fetch(url, {
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/json',
      }
    });
    
    const end = performance.now();
    const duration = (end - start).toFixed(2);
    const data = await response.json();
    const recordCount = Array.isArray(data) ? data.length : (data.data?.length || 0);
    const totalRecords = data.total || data.data?.length || recordCount;
    const responseSize = JSON.stringify(data).length;
    
    console.log(`\n📊 ${name}`);
    console.log(`   ⏱️  Time: ${duration}ms`);
    console.log(`   📦 Records: ${recordCount}${totalRecords !== recordCount ? ` / ${totalRecords}` : ''}`);
    console.log(`   📏 Size: ${(responseSize / 1024).toFixed(1)} KB`);
    console.log(`   ${response.ok ? '✅' : '❌'} Status: ${response.status}`);
    
    return {
      name,
      duration: parseFloat(duration),
      records: recordCount,
      totalRecords,
      size: responseSize,
      status: response.status,
      ok: response.ok,
      error: !response.ok ? await response.text() : null
    };
  } catch (error) {
    console.log(`\n📊 ${name}`);
    console.log(`   ❌ Error: ${error.message}`);
    return {
      name,
      error: error.message
    };
  }
}

function buildUrl(endpoint, params) {
  const url = new URL(`${API_BASE}${endpoint}`);
  url.searchParams.set('dateFrom', DATE_FROM);
  url.searchParams.set('dateTo', DATE_TO);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return url.toString();
}

async function runBenchmarks(cookie) {
  console.log('═'.repeat(60));
  console.log('🚀 Smart Family Finance - Performance Benchmark');
  console.log('═'.repeat(60));
  
  const results = [];
  
  // 1. Transactions First Load (page 1, limit 50)
  results.push(await benchmarkQuery(
    '1️⃣  Transactions First Load (50 records)',
    buildUrl('/api/transactions', { page: 1, limit: 50 }),
    cookie
  ));
  
  // 2. Load More (page 2)
  results.push(await benchmarkQuery(
    '2️⃣  Load More (page 2, 50 records)',
    buildUrl('/api/transactions', { page: 2, limit: 50 }),
    cookie
  ));
  
  // 3. Category Filter
  results.push(await benchmarkQuery(
    '3️⃣  Category Filter (cat_food)',
    buildUrl('/api/transactions', { page: 1, limit: 50, categoryId: 'cat_food' }),
    cookie
  ));
  
  // 4. Account Filter
  results.push(await benchmarkQuery(
    '4️⃣  Account Filter (acc_thanet_kbank)',
    buildUrl('/api/transactions', { page: 1, limit: 50, accountId: 'acc_thanet_kbank' }),
    cookie
  ));
  
  // 5. Date Filter (this month)
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  const thisMonthEnd = new Date();
  results.push(await benchmarkQuery(
    '5️⃣  Date Filter (เดือนนี้)',
    `${API_BASE}/api/transactions?page=1&limit=50&dateFrom=${thisMonthStart.toISOString()}&dateTo=${thisMonthEnd.toISOString()}`,
    cookie
  ));
  
  // 6. Account Detail
  results.push(await benchmarkQuery(
    '6️⃣  Account Detail (acc_thanet_kbank)',
    `${API_BASE}/api/accounts/acc_thanet_kbank/transactions?page=1&limit=50`,
    cookie
  ));
  
  // 7. Dashboard / Accounts Summary
  results.push(await benchmarkQuery(
    '7️⃣  Dashboard (All Accounts)',
    `${API_BASE}/api/accounts`,
    cookie
  ));
  
  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📋 SUMMARY');
  console.log('═'.repeat(60));
  
  const successfulResults = results.filter(r => !r.error);
  if (successfulResults.length > 0) {
    console.log('\nQuery Performance:');
    successfulResults.forEach(r => {
      const timeEmoji = r.duration < 100 ? '⚡' : r.duration < 500 ? '📊' : '🐌';
      console.log(`  ${timeEmoji} ${r.name}: ${r.duration}ms`);
    });
    
    const avgTime = (successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length).toFixed(2);
    console.log(`\n  📈 Average: ${avgTime}ms`);
  }
  
  if (results.some(r => r.error)) {
    console.log('\n❌ Errors:');
    results.filter(r => r.error).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
  
  return results;
}

// CLI mode
if (typeof require !== 'undefined' && require.main === module) {
  const args = process.argv.slice(2);
  const cookieIndex = args.indexOf('--cookie');
  
  if (cookieIndex === -1 || !args[cookieIndex + 1]) {
    console.log('Usage: node benchmark.js --cookie "session=xxx"');
    console.log('\nTo get cookie:');
    console.log('1. Open browser DevTools (F12)');
    console.log('2. Go to Application > Cookies');
    console.log('3. Copy session cookie value');
    process.exit(1);
  }
  
  const cookie = args[cookieIndex + 1];
  runBenchmarks(cookie).then(() => process.exit(0));
}

// Export for browser console
if (typeof window !== 'undefined') {
  window.runBenchmarks = runBenchmarks;
}

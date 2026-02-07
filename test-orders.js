// Simple test to verify the orders data structure is correct
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      console.log('✅ Data loaded successfully');
      console.log(`📦 Total orders: ${data.orders.length}`);
      console.log(`📋 Total menu items: ${data.menu.length}`);
      
      // Verify order structure
      if (data.orders.length > 0) {
        console.log('\n📝 Sample order structure:');
        console.log(JSON.stringify(data.orders[0], null, 2));
      }
      
      return data;
    } else {
      console.error('❌ data.json not found');
    }
  } catch (err) {
    console.error('❌ Error loading data:', err);
  }
}

function testStatisticsCalculation(data) {
  console.log('\n🧮 Testing statistics calculation:');
  
  const orders = data.orders || [];
  if (orders.length === 0) {
    console.log('No orders to calculate statistics');
    return;
  }
  
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const avgOrder = Math.round(totalRevenue / totalOrders);
  
  const itemCounts = {};
  orders.forEach(o => {
    o.items.forEach(it => {
      itemCounts[it.name] = (itemCounts[it.name] || 0) + it.qty;
    });
  });
  
  const popularItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];
  const popularItemName = popularItem ? popularItem[0] : '-';
  
  console.log(`  Total Orders: ${totalOrders}`);
  console.log(`  Total Revenue: ₹${totalRevenue}`);
  console.log(`  Average Order: ₹${avgOrder}`);
  console.log(`  Popular Item: ${popularItemName}`);
  
  console.log('\n  Top 5 Items:');
  Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([name, count]) => {
      console.log(`    - ${name}: ${count} orders`);
    });
}

// Run tests
const data = loadData();
if (data) {
  testStatisticsCalculation(data);
  console.log('\n✅ All tests completed!');
}

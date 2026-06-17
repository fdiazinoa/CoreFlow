const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("=== VERIFYING SUPPLIERS DB SCHEMAS ===");
  
  // 1. Fetching suppliers
  console.log("\n1. Fetching spare_part_suppliers...");
  const { data: suppliers, error: supErr } = await supabase
    .from('spare_part_suppliers')
    .select('*');

  if (supErr) {
    console.error("Error reading spare_part_suppliers (migration may not be applied yet):", supErr.message);
  } else {
    console.log(`Success! Found ${suppliers.length} suppliers:`, suppliers);
    
    // 2. Try inserting a test supplier
    console.log("\n2. Trying to insert a test supplier...");
    const testName = `Test-Supplier-${Date.now()}`;
    const { data: inserted, error: insErr } = await supabase
      .from('spare_part_suppliers')
      .insert({ name: testName })
      .select();
      
    if (insErr) {
      console.error("Error inserting test supplier:", insErr.message);
    } else {
      console.log("Success! Inserted:", inserted);
      
      // Clean up test supplier
      console.log("Cleaning up test supplier...");
      await supabase
        .from('spare_part_suppliers')
        .delete()
        .eq('name', testName);
    }
  }

  // 3. Check spare_parts supplier column mapping
  console.log("\n3. Fetching one spare part to check 'supplier' column...");
  const { data: parts, error: partErr } = await supabase
    .from('spare_parts')
    .select('id, sku, name, supplier')
    .limit(1);

  if (partErr) {
    console.error("Error fetching spare parts:", partErr.message);
  } else {
    console.log("Success! Spare part row:", parts[0]);
  }
}

check();

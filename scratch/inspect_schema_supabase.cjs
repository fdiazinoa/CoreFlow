const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Fetching one spare part...");
  const { data, error } = await supabase.from('spare_parts').select('*').limit(1);
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Spare part columns:", Object.keys(data[0] || {}));
    console.log("Spare part sample row:", data[0]);
  }

  // Check if spare_part_suppliers exists by querying it
  console.log("Checking if spare_part_suppliers exists...");
  const { data: suppliers, error: suppliersErr } = await supabase.from('spare_part_suppliers').select('*').limit(1);
  if (suppliersErr) {
     console.log("spare_part_suppliers error (likely doesn't exist):", suppliersErr.message);
  } else {
     console.log("spare_part_suppliers exists! Sample row:", suppliers[0]);
  }
}
check();

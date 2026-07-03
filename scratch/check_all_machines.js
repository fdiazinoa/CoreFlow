import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: machines, error } = await supabase
    .from('machines')
    .select('id, name, code, created_at, next_maintenance');

  if (error) {
    console.error("Error fetching machines:", error);
    return;
  }

  console.log("Machines and their next_maintenance dates:");
  machines.forEach(m => {
    console.log(`- Machine: ${m.name} (${m.code || m.id})`);
    console.log(`  Created At: ${m.created_at}`);
    console.log(`  Next Maint: ${m.next_maintenance}`);
  });
}

check();

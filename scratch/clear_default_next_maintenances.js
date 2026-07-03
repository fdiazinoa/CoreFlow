import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function clean() {
  console.log("Fetching all machines from database...");
  const { data: machines, error } = await supabase
    .from('machines')
    .select('id, name, code, next_maintenance');

  if (error) {
    console.error("Error fetching machines:", error);
    return;
  }

  console.log(`Found ${machines.length} machines. Analyzing next_maintenance dates...`);
  
  let clearedCount = 0;
  for (const m of machines) {
    if (m.next_maintenance) {
      // If the next_maintenance date contains '00:00:00', it was manually entered in the usage logs.
      // If it doesn't, it is a default 30-day offset date created by MachinesList/Dashboard (e.g. 2026-07-31T02:04:21.65+00:00).
      if (!m.next_maintenance.includes('00:00:00')) {
        console.log(`Clearing default next_maintenance for ${m.name} (${m.code || m.id}): current value is ${m.next_maintenance}`);
        
        const { error: updateError } = await supabase
          .from('machines')
          .update({ next_maintenance: null })
          .eq('id', m.id);

        if (updateError) {
          console.error(`  [ERROR] Failed to clear next_maintenance for ${m.name}:`, updateError);
        } else {
          console.log(`  [SUCCESS] Cleared.`);
          clearedCount++;
        }
      } else {
        console.log(`Keeping manual next_maintenance for ${m.name} (${m.code || m.id}): ${m.next_maintenance}`);
      }
    }
  }

  console.log(`\nCleanup complete! Cleared next_maintenance for ${clearedCount} machines.`);
}

clean();

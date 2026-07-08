import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars", { supabaseUrl, supabaseKey: !!supabaseKey });
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function sync() {
  console.log("Fetching machines from database...");
  const { data: machines, error: machinesError } = await supabase
    .from('machines')
    .select('id, name, running_hours, serial_number, code');

  if (machinesError) {
    console.error("Error fetching machines:", machinesError);
    return;
  }

  console.log(`Found ${machines.length} machines. Checking usage logs...`);

  for (const m of machines) {
    // Get the latest log for this machine
    const { data: logs, error: logsError } = await supabase
      .from('machine_hour_logs')
      .select('hours_logged, date, created_at')
      .eq('machine_id', m.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);

    if (logsError) {
      console.error(`Error fetching logs for machine ${m.name} (${m.id}):`, logsError);
      continue;
    }

    if (logs && logs.length > 0) {
      const latestReading = logs[0].hours_logged;
      const currentRunningHours = Number(m.running_hours);
      
      console.log(`Machine: ${m.name} (${m.code || m.serial_number || m.id})`);
      console.log(`  - DB running_hours: ${currentRunningHours}`);
      console.log(`  - Latest log reading: ${latestReading} (Date: ${logs[0].date})`);
      
      if (currentRunningHours !== latestReading) {
        console.log(`  => DISCREPANCY DETECTED! Syncing running_hours to ${latestReading}...`);
        const { error: updateError } = await supabase
          .from('machines')
          .update({ running_hours: latestReading })
          .eq('id', m.id);
          
        if (updateError) {
          console.error(`  [ERROR] Failed to update machine ${m.name}:`, updateError);
        } else {
          console.log(`  [SUCCESS] Updated successfully.`);
        }
      } else {
        console.log(`  => In sync.`);
      }
    } else {
      console.log(`Machine: ${m.name} (${m.code || m.serial_number || m.id}) has no logs in machine_hour_logs.`);
    }
  }

  console.log("\nSync process completed!");
}

sync();

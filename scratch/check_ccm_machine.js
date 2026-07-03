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

async function check() {
  console.log("Searching for machine CCM48SD-L6 in the database...");
  const { data: machines, error: machinesError } = await supabase
    .from('machines')
    .select('*')
    .or('name.eq.CCM48SD-L6,code.eq.CCM48SD-L6');

  if (machinesError) {
    console.error("Error fetching machines:", machinesError);
    return;
  }

  console.log(`Found ${machines.length} machine(s):`);
  for (const m of machines) {
    console.log(JSON.stringify(m, null, 2));

    console.log(`\nFetching logs for machine ID ${m.id} in machine_hour_logs...`);
    const { data: logs, error: logsError } = await supabase
      .from('machine_hour_logs')
      .select('*')
      .eq('machine_id', m.id)
      .order('date', { ascending: false });

    if (logsError) {
      console.error("Error fetching machine_hour_logs:", logsError);
    } else {
      console.log(`Found ${logs.length} logs in machine_hour_logs:`);
      console.log(JSON.stringify(logs, null, 2));
    }
  }
}

check();

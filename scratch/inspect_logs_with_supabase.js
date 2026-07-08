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

async function inspect() {
  console.log("Fetching up to 5 logs from machine_hour_logs...");
  const { data: logs, error } = await supabase
    .from('machine_hour_logs')
    .select('*')
    .limit(5);

  if (error) {
    console.error("Error fetching logs:", error);
    return;
  }

  console.log(`Found ${logs.length} logs:`);
  console.log(JSON.stringify(logs, null, 2));
}

inspect();

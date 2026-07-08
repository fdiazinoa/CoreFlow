import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: logs, error } = await supabase
    .from('machine_hour_logs')
    .select('id, machine_id, date, created_at, hours_logged');

  if (error) {
    console.error("Error fetching logs:", error);
    return;
  }

  console.log(`Found ${logs.length} total logs:`);
  for (const l of logs) {
    const { data: machine } = await supabase
      .from('machines')
      .select('name, code')
      .eq('id', l.machine_id)
      .single();
    console.log(`- Log ID: ${l.id}, Machine: ${machine?.name} (${machine?.code || l.machine_id}), Date: ${l.date}, Created At: ${l.created_at}, Hours: ${l.hours_logged}`);
  }
}

check();

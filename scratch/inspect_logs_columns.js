import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data, error } = await supabase
    .from('machine_hour_logs')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Columns in machine_hour_logs:", data && data.length > 0 ? Object.keys(data[0]) : "No data to inspect columns, fetching schema table info");
  
  // Let's query pg_attribute to get all columns of machine_hour_logs
  const { data: cols, error: colsError } = await supabase
    .rpc('inspect_table_cols', { table_name: 'machine_hour_logs' }); // might not exist

  if (colsError) {
    // Try raw query or select * from information_schema.columns
    const { data: infoCols, error: infoError } = await supabase
      .from('machine_hour_logs')
      .select('id')
      .limit(0); // just to verify if we can do info schema
    
    // We can also query using supabase's REST API/PostgREST on information_schema.columns if exposed, but usually it's not.
    // Let's just do a query using `pg` library since package.json has "pg"!
    console.log("pg is in package.json. Let's use PG client to inspect database.");
  }
}

inspect();

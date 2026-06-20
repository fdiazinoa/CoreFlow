const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const envVars = {};
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      envVars[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });

  const url = envVars['VITE_SUPABASE_URL'];
  const key = envVars['VITE_SUPABASE_ANON_KEY'];

  console.log("Connecting to Supabase...");
  const supabase = createClient(url, key);

  console.log("Querying profiles...");
  const { data: profiles, error: err1 } = await supabase.from('profiles').select('id, email, full_name, role_id');
  if (err1) {
    console.error("Error querying profiles:", err1);
  } else {
    console.log("Profiles in DB:", profiles);
  }
}

main();

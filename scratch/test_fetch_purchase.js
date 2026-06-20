import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('purchase_requests').select('*').limit(2);
  if (error) {
    console.error("Error fetching purchase requests:", error);
  } else {
    console.log("Purchase Requests:", data);
  }
}
check();

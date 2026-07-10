import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'wilfredo.torrez@ravicaribeinc.com');
    
    console.log("Profile:", profiles, error);

    const { data: branches, error: err2 } = await supabase.from('branches').select('*');
    console.log("Branches:", branches, err2);
}

run();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://afoiqosppffsvmsbczsf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmb2lxb3NwcGZmc3Ztc2JjenNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTk1MTEsImV4cCI6MjA4OTk3NTUxMX0.CtHLXszed5gOpNVlvTs4EOSpEZ_wU0_sb91f35fd0xA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'wilfredo.torrez@ravicaribeinc.com');
    
    console.log("Profile:", profiles);

    const { data: branches, error: err2 } = await supabase.from('branches').select('*');
    console.log("Branches:", branches);
}

run();

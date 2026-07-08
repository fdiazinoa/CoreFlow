const dns = require('dns');

dns.resolve('afoiqosppffsvmsbczsf.supabase.co', 'A', (err, records) => {
    if (err) {
        console.error("A record error:", err);
    } else {
        console.log('A RECORDS:', records);
    }
});

dns.resolve('afoiqosppffsvmsbczsf.supabase.co', 'CNAME', (err, records) => {
    if (err) {
        console.error("CNAME record error:", err);
    } else {
        console.log('CNAME RECORDS:', records);
    }
});

dns.lookup('afoiqosppffsvmsbczsf.supabase.co', (err, address, family) => {
    if (err) {
        console.error("Lookup error:", err);
    } else {
        console.log('LOOKUP address:', address);
    }
});

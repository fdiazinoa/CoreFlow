const { Client } = require('pg');

async function check() {
    const client = new Client({
        connectionString: 'postgresql://postgres.eujtldssxdafrlhllnto:CoreFlowPassword2024!@aws-0-us-west-1.pooler.supabase.com:6543/postgres',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Successfully connected to production eujtldssxdafrlhllnto!');
        const res = await client.query('SELECT current_database();');
        console.log('Current DB:', res.rows[0]);
    } catch (e) {
        console.error('Connection failed:', e);
    } finally {
        await client.end();
    }
}

check();

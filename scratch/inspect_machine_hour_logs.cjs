const { Client } = require('pg');

const regions = [
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'eu-central-1',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ap-northeast-2',
    'sa-east-1',
    'ca-central-1',
    'me-central-1',
    'af-south-1'
];

async function run() {
    const projectId = 'afoiqosppffsvmsbczsf';
    const password = 'CoreFlowPassword2024!';

    let connectedClient = null;
    for (const r of regions) {
        const host = `aws-0-${r}.pooler.supabase.com`;
        const client = new Client({
            connectionString: `postgresql://postgres.${projectId}:${password}@${host}:6543/postgres`,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 3000
        });

        try {
            await client.connect();
            console.log(`Connected to database in region: ${r}`);
            connectedClient = client;
            break;
        } catch (e) {
            // Try next region
        }
    }

    if (!connectedClient) {
        console.error('Could not connect to any database region.');
        return;
    }

    try {
        const colsRes = await connectedClient.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'machine_hour_logs'
            ORDER BY column_name;
        `);
        console.log('--- Columns of machine_hour_logs ---');
        colsRes.rows.forEach(row => {
            console.log(`${row.column_name}: ${row.data_type}`);
        });

        // Let's also inspect a few rows if they exist
        const rowsRes = await connectedClient.query(`
            SELECT * FROM machine_hour_logs LIMIT 5;
        `);
        console.log('--- Sample Rows of machine_hour_logs ---');
        console.log(JSON.stringify(rowsRes.rows, null, 2));

    } catch (e) {
        console.error('Query failed:', e);
    } finally {
        await connectedClient.end();
    }
}

run();

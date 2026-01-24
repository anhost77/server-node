import { createClient } from '@libsql/client';
const client = createClient({ url: 'file:data/auth.db' });
async function check() {
    const nodes = await client.execute('SELECT * FROM nodes');
    console.log('--- NODES ---');
    console.table(nodes.rows);
}
check().catch(console.error);

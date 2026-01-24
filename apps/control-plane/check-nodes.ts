import { createClient } from '@libsql/client';
const client = createClient({ url: 'file:data/auth.db' });
async function run() {
    const res = await client.execute('SELECT * FROM nodes');
    res.rows.forEach(r => {
        console.log(`Node: ${r.id}, Owner: ${r.owner_id}, Status: ${r.status}`);
    });
}
run();

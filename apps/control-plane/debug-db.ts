import { createClient } from '@libsql/client';

const client = createClient({ url: 'file:data/auth.db' });

async function check() {
    const nodes = await client.execute('SELECT * FROM nodes');
    const users = await client.execute('SELECT * FROM users');
    const sessions = await client.execute('SELECT * FROM sessions');
    const tokens = await client.execute('SELECT * FROM registration_tokens');

    console.log('--- NODES ---');
    console.table(nodes.rows);
    console.log('--- USERS ---');
    console.table(users.rows);
    console.log('--- SESSIONS ---');
    console.table(sessions.rows);
    console.log('--- TOKENS ---');
    console.table(tokens.rows);
}

check().catch(console.error);

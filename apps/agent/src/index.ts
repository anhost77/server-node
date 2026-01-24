import Fastify from 'fastify';
import websocket from '@fastify/websocket';

const fastify = Fastify({
    logger: true
});

fastify.register(websocket);

fastify.get('/', async function handler(request, reply) {
    return { hello: 'agent' }
});

const start = async () => {
    try {
        await fastify.listen({ port: 3001 });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();

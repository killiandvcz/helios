import {Helios} from "../index.js";

const helios = new Helios();

helios.method("echo", context => {
    console.log("Echo", context.payload);

    context.success({
        echo: "Hello world"
    });
});

helios.methods.echoAllMethods();

Bun.serve({
    fetch(request, server) {
        if (request.headers.get('upgrade') === 'websocket') {
            return server.upgrade(request);
        }
    },
    websocket: helios
})
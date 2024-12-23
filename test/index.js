import {Helios} from "../index.js";

const helios = new Helios({
    connectionKey: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]),
});
helios.debug();

helios.method("echo", context => {
    const {starling} = context;

    starling.request("echo", {
        echo: "Hello from echo"
    }).then(response => {
        console.log("Echo response", response);
    });

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
    port: 8080,
    websocket: helios
});

console.log("Server started on port 8080");
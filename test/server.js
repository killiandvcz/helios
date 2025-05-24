import { Helios } from "../src";

const starlings = {}

const helios = new Helios();



helios.onconnection(starling => {
    console.log("New connection established:", starling.id);
    starling.request("manifest").then(response => {
        starling.set("manifest", response.data);
        starlings[response.data.name] = starling;
    });
})

helios.useProxy(async (context) => {
    console.log("Proxy handler called for message:", context.message);

    const {message} = context;
    if (message.peer?.name) {
        const peer = starlings[message.peer.name];
        console.log("Proxying message to peer:", peer?.id || "not found");
        if (peer) {
            const response = await context.forward(peer);
            if (response) context.reply(response.data);
            else context.deny("Peer not found", 404);
        }
    }

    // Here you can implement any custom logic for proxying messages
    // For example, you could modify the message or route it to a different handler
    return context.reply({
        status: "success",
        data: context.message.data
    })
});

helios.method("user:create", async context => {
    return context.success({
        id: 1,
        name: "John Doe",
        email: "johndoe@example.com"
    });
});

helios.serve();

console.log(helios.methods.list)
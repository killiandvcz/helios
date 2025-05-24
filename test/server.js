import { Helios } from "$";

const helios = new Helios();

helios.useProxy(async (context) => {
    console.log("Proxy handler called for message:", context.message);
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
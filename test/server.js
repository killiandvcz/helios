import { Helios } from "$";

const helios = new Helios();

helios.method("user:create", async context => {
    return context.success({
        id: 1,
        name: "John Doe",
        email: "johndoe@example.com"
    });
});

helios.serve();

console.log(helios.methods.list)
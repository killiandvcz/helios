import { Pulse } from "@killiandvcz/pulse";
import { Starling } from "../core/starling";

export class Starlings {
    /** @param {import('../core/helios').Helios} helios */
    constructor(helios) {
        this.helios = helios;
        this.events = new Pulse();
        /** @type {Map<import('bun').ServerWebSocket, import('../core/starling').Starling>} */
        this.connections = new Map();
    }

    /** @param {import('bun').ServerWebSocket} ws */
    connect = async ws => {
        try {
            const starling = new Starling(this.helios, ws);
            this.connections.set(ws, starling);
            this.events.emit("new", { starling });
        } catch (error) {
            
        }
    }

    get = ws => {
        const starling = this.connections.get(ws);
        if (!starling) throw new Error("Starling not found");
        return starling;
    }

    clear = ws => {
        const starling = this.connections.get(ws);
        if (!starling) throw new Error("Starling not found");
        this.connections.delete(ws);
    }
}
export class Requests {
    /**
     * @param starling {Starling}
     */
    constructor(starling) {
        this.starling = starling;
        this.requests = new Map();
    }
}
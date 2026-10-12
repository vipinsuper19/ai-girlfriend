export class ClientDisconnectedError extends Error {
    constructor() {
        super('Client disconnected');
        this.name = 'ClientDisconnectedError';
    }
}

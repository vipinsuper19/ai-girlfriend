export default () => ({
    app: {
        env: process.env.NODE_ENV,
        port: parseInt(process.env.PORT ?? '3001', 10),
        corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000'
    }
});
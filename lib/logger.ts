import * as winston from 'winston';

const logger: winston.Logger = winston.createLogger({
    level: 'info',
    transports: [
        new winston.transports.File({
            filename: 'error.log', level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format.prettyPrint())
        }),
        new winston.transports.File({
            filename: 'combined.log',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format.prettyPrint()),
        })
    ]
});

const consoleFormat = winston.format.printf(({ level, message, label, timestamp, metadata }) => {
    return `[${timestamp}]${label ? ` [${label}] `: ''} ${level}: ${message}${Object.keys(metadata).length > 0 ? '\n'+JSON.stringify(metadata, null, 2) : ''}`;
})

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console(
        {
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.colorize(),
                winston.format.splat(),
                winston.format.metadata({fillExcept: ['timestamp', 'level', 'message', 'label']}),
                consoleFormat)
        })
    );
}

export default logger
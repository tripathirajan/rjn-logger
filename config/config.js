module.exports = {
    logDir: 'logs',
    targets: {
        console: {
            singleLine: false,
            colorize: true
        },
        file: {
            fileName: '%fileName%-%DATE%',
            ext: 'log',
            // contentFormat: '',
            maxLogs: '10d',
            frequency: '24h',
            size: '1m',
            dateFormat: 'YYYY-MM-DD',
            // format: '',
            prettyConfig: {
                singleLine: false,
                colorize: false
            }
        },
        remote: {
            url: '',
            method: 'POST',
            format: '',
            prettyConfig: {
                singleLine: false,
                colorize: false
            }
        },
        elastic: {
            uri: '',
            indexName: '',
            docType: 'log',
            fields: [
                { fieldName: 'level', valueIndex: 'logLevel' },
                { fieldName: 'details', valueIndex: 'message' },
            ]
        }
    },
    rules: [
        { loggerName: '*', level: 'info', outputMode: 'console' },
        { loggerName: '*', level: 'debug', outputMode: 'file' },
        { loggerName: '*', level: 'error', outputMode: 'file' }
    ],
    disableLogger: []
}


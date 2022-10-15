const pino = require("pino");
const pinoMultiStream = pino.multistream;
const loggerConfigs = require('../config');
const path = require('path');
const { getPrettifiedStream, toFileNameCase, ensureDirSync } = require('./utility');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const { stdout } = require('process');
dayjs.extend(utc);

const fsRotator = require('file-stream-rotator');

const ROOT_DIR = process.cwd();

const defaultPrettyPrintConfig = {
    translateTime: 'SYS:yyyy-mm-dd h:MM:ss',
    ignore: '',
    colorize: true,
    singleLine: false,
    levelFirst: false,
    ignore: "logLevel,logger"
}

class LoggerConfiguration {
    #streams = [];
    #disabledLogger = [];
    #targets = [];
    #rules = [];
    #logDir = 'logs';
    #logPath = '';
    #targetParser = {
        logPath: '',
        file: this.#getFileTarget,
        console: this.#getConsoleTarget,
        remote: this.#getRemoteTarget,
        elastic: this.#getElasticTarget
    };
    constructor(loggerName = 'loggerName') {
        this.#bindConfigurations();
        this.#refractorRules(loggerName);
        this.#ensureLoggerDIR();
        if (!this.#rules || this.#rules?.length === 0) {
            throw new Error("rules not defined for logger.")
        }
        if (!this.#targets) {
            throw new Error("targets are not configured.")
        }
        this.#applyLoggerRules();

    }
    getStreamList() {
        return this.#streams;
    }
    getDisabledLogger() {
        return this.#disabledLogger;
    }
    #bindConfigurations() {
        this.#targets = loggerConfigs?.targets;
        this.#rules = loggerConfigs?.rules;
        this.#logDir = loggerConfigs?.logDir || this.#logDir;
        this.#disabledLogger = loggerConfigs?.disabledLogger || [];
    }
    #ensureLoggerDIR() {
        this.#logPath = path.join(ROOT_DIR, this.#logDir);
        this.#targetParser.logPath = this.#logPath;
        ensureDirSync(this.#logPath);
    }
    #applyLoggerRules() {
        let fileName = "";
        let outputType = [];
        const streamRules = [];
        for (const { loggerName, level, outputMode } of this.#rules) {
            fileName = toFileNameCase(loggerName === '*' ? level : loggerName);
            outputType = outputMode?.split(',');
            for (const outMode of outputType) {
                const destination = this.#getOutputModeTarget(fileName, outMode);
                if (destination && destination.dest) {
                    streamRules.push(this.#getStream({ level, ...destination }));
                }
            }
        }
        this.#streams = streamRules;
    }
    #refractorRules(loggerName) {
        const loggerRules = this.#rules.filter(rule => rule.loggerName !== "*" && rule.loggerName === loggerName);
        const rulesCopy = [...this.#rules];
        let ruleList = rulesCopy.filter(r => (!loggerRules.find(t => r.level == t.level && r.loggerName == "*") && (r.loggerName === loggerName || r.loggerName === '*')));
        this.#rules = [...ruleList];
    }
    #getStream({ level, dest, prettyPrint = null }) {
        return {
            level,
            stream: prettyPrint ? getPrettifiedStream({ dest, prettyPrint }) : dest,
        }
    }
    #getOutputModeTarget(loggerName, mode = "console") {
        const targetModes = Object.keys(this.#targets);
        if (!targetModes?.includes(mode)) {
            throw new Error(`Output mode: ${mode} not defined in target config.`);
        }
        return this.#targetParser[mode](loggerName, this.#targets[mode]);
    }
    #getConsoleTarget(loggerName = '', config = {}) {
        return {
            dest: stdout,
            prettyPrint: Object.assign({}, {
                hideObject: true,
                messageFormat: (log, messageKey) => {
                    return `${log['message']?.trim()} `
                },
                ...config
            })
        }
    }
    #getFileTarget(loggerName, { fileName = '%fileName%-%DATE%', ext = 'log', dateFormat, maxLogs, prettyConfig, ...rest }) {
        const logFileName = fileName.replace('%fileName%', loggerName);
        return {
            dest: fsRotator.getStream({
                filename: `${this.logPath}/${logFileName}.${ext}`,
                verbose: false,
                date_format: dateFormat,
                max_logs: maxLogs,
                ...rest
            }),
            prettyPrint: Object.assign(defaultPrettyPrintConfig, {
                ...prettyConfig,
                hideObject: true,
                messageFormat: function (log, messageKey) {
                    const { reqInfo, message, fileName, lineNumber, errorType, stack } = log;
                    const { req = '', server = '', user = '' } = reqInfo || {};
                    return (` ${message} \n Request= ${JSON.stringify(req)} \n Server = ${JSON.stringify(server)} \n User = ${user} \n Message = ${stack?.message || ''} \n File = ${fileName} ${lineNumber} \n ErrorType = ${errorType} \n Stack = ${stack}`)
                }
            })
        }
    }
    #getElasticTarget() {
        return {};
    }
    #getRemoteTarget() {
        return {}
    }
}

class RJNLogger {
    #instanse = {}
    #loggerConfig = null;
    #dateTimeFormat = 'YYYY-MM-DD HH:mm:ss';
    constructor(loggername = 'logger', loggerConfig) {
        this.#loggerConfig = loggerConfig;
        this.#instanse = this.#getNewLoggerInstance(loggername);
    }
    getInstance() {
        return this.#instanse;
    }
    #getNewLoggerInstance(loggerName) {
        const logger = pino({
            name: loggerName,
            enabled: true,
            level: 'trace',
            timestamp: () => `,"time":"${dayjs().format(this.#dateTimeFormat)}"`,
            messageKey: 'message',
            mixin(_context, level) {
                return { logger: loggerName, logLevel: pino.levels.labels[level] };
            },
            formatters: {
                level(label, number) {
                    return { level: label?.toUpperCase() };
                },
                bindings(bindings) {
                    return { pid: bindings.pid, hostname: bindings.hostname }
                }
            }
        }, pinoMultiStream(this.#loggerConfig.getStreamList(), { dedupe: true }))
        const log = this.#log(logger);
        const logWithException = this.#logWithException(log);
        return {
            trace: (...args) => { log('trace', ...args) },
            info: (...args) => { log('info', ...args) },
            warn: (...args) => { log('warn', ...args) },
            debug: (error) => { logWithException('debug', error) },
            error: (error) => { logWithException('error', error) }
        }
    }
    #log(logger) {
        return (level = logLevel.info, ...args) => {
            logger[level](...args)
        }
    }
    #logWithException(log) {
        return (level = logLevel.error, error) => {
            const req = global?.reqInfo;
            const ex = error instanceof Error ? error : new Error(error);
            const frame = ex?.stack.split('\n')[1]?.split(' ');
            const filePath = frame[frame?.length - 1]?.split('/');
            const fileInfo = filePath[filePath?.length - 1]?.split(':');
            const fileName = fileInfo[0];
            const lineNumber = `${fileInfo[1]}:${fileInfo[2].replace(')', '')}`;

            const errorInfo = {
                // If we have a request object then parse it otherwise it is null
                reqInfo: req
                    ? {
                        req: {
                            req: req?.method,
                            path: req?.path,
                            body: req?.body,
                            query: req?.query,
                            params: req?.params,
                            host: req?.headers?.host,
                        },
                        user: req?.user
                            ? {
                                id: req.user.id,
                                name: req.user.name,
                            }
                            : null,
                        server: {
                            ip: req.ip,
                            servertime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                        },
                    }
                    : null,
                message: ex?.message,
                fileName,
                lineNumber,
                errorType: ex?.name,
                stack: ex?.stack,
                env: process.env.NODE_ENV || 'development'
            }
            log(level, errorInfo);
        }
    }
}

class LogManager {
    static #instance = {};
    getLogger(loggerName) {
        let logger = null;
        const existingLogger = Object.keys(LogManager.#instance);
        if (existingLogger?.length == 0 || !existingLogger?.includes(loggerName)) {
            logger = new RJNLogger(loggerName, new LoggerConfiguration(loggerName)).getInstance();
            LogManager.#instance[logger] = logger;
        } else {
            logger = LogManager.#instance[loggerName];
        }
        return logger;
    }
}
const logManager = new LogManager();
module.exports = logManager;
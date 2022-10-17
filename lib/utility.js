const {
    chindingsSym,
    parsedChindingsSym,
    serializersSym,
    stringifiersSym,
    needsMetadataGsym,
    redactFmtSym,
    formattersSym,
    messageKeySym,
} = require('pino/lib/symbols')
const fs = require('fs');
const path = require('path');

const DIR_MODE = 0o777;
const WIN_32 = 'win32';
const PATH_REGEX = /[<>:"|?*]/;

function getPrettyStream(opts, prettifier, dest, instance) {
    if (prettifier && typeof prettifier === 'function') {
        prettifier = prettifier.bind(instance)
        return prettifierMetaWrapper(prettifier(opts), dest, opts)
    }
    try {
        const prettyFactory = require('pino-pretty').prettyFactory
        prettyFactory.asMetaWrapper = prettifierMetaWrapper
        return prettifierMetaWrapper(prettyFactory(opts), dest, opts)
    } catch (e) {
        throw e
    }
}

function prettifierMetaWrapper(pretty, dest, opts) {
    opts = Object.assign({ suppressFlushSyncWarning: false }, opts)
    let warned = false
    return {
        [needsMetadataGsym]: true,
        lastLevel: 0,
        lastMsg: null,
        lastObj: null,
        lastLogger: null,
        flushSync() {
            if (opts.suppressFlushSyncWarning || warned) {
                return
            }
            warned = true
            setMetadataProps(dest, this)
            dest.write(pretty(Object.assign({
                level: 40, // warn
                msg: 'pino.final with prettyPrint does not support flushing',
                time: Date.now()
            }, this.chindings())))
        },
        chindings() {
            const lastLogger = this.lastLogger
            let chindings = null

            // protection against flushSync being called before logging
            // anything
            if (!lastLogger) {
                return null
            }

            if (lastLogger.hasOwnProperty(parsedChindingsSym)) {
                chindings = lastLogger[parsedChindingsSym]
            } else {
                chindings = JSON.parse('{' + lastLogger[chindingsSym].substr(1) + '}')
                lastLogger[parsedChindingsSym] = chindings
            }

            return chindings
        },
        write(chunk) {
            const lastLogger = this.lastLogger
            const chindings = this.chindings()

            let time = this.lastTime

            /* istanbul ignore next */
            if (typeof time === 'number') {
                // do nothing!
            } else if (time.match(/^\d+/)) {
                time = parseInt(time)
            } else {
                time = time.slice(1, -1)
            }

            const lastObj = this.lastObj
            const lastMsg = this.lastMsg
            const errorProps = null

            const formatters = lastLogger[formattersSym]
            const formattedObj = formatters.log ? formatters.log(lastObj) : lastObj

            const messageKey = lastLogger[messageKeySym]
            if (lastMsg && formattedObj && !Object.prototype.hasOwnProperty.call(formattedObj, messageKey)) {
                formattedObj[messageKey] = lastMsg
            }

            const obj = Object.assign({
                level: this.lastLevel,
                time
            }, formattedObj, errorProps)

            const serializers = lastLogger[serializersSym]
            const keys = Object.keys(serializers)

            for (var i = 0; i < keys.length; i++) {
                const key = keys[i]
                if (obj[key] !== undefined) {
                    obj[key] = serializers[key](obj[key])
                }
            }

            for (const key in chindings) {
                if (!obj.hasOwnProperty(key)) {
                    obj[key] = chindings[key]
                }
            }
            const stringifiers = lastLogger[stringifiersSym]
            const redact = stringifiers[redactFmtSym]

            const formatted = pretty(typeof redact === 'function' ? redact(obj) : obj)
            if (formatted === undefined) return

            setMetadataProps(dest, this)
            dest.write(formatted)
        }
    }
}
function setMetadataProps(dest, that) {
    if (dest[needsMetadataGsym] === true) {
        dest.lastLevel = that.lastLevel
        dest.lastMsg = that.lastMsg
        dest.lastObj = that.lastObj
        dest.lastTime = that.lastTime
        dest.lastLogger = that.lastLogger
    }
}

const getPrettifiedStream = (args = {}) => {
    const prettyPrint = args.opts || args.prettyPrint
    const { prettifier, dest = process.stdout } = args
    return getPrettyStream(prettyPrint, prettifier, dest)
}
const toFileNameCase = (str) => {
    if (!str) {
        return str
    }
    const arr = str.split(" ");
    for (var i = 0; i < arr.length; i++) {
        arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1);
    }
    const str2 = arr.join(" ");
    return str2;
}

/**
 * @description create directory if not exists on given path
 * @param {string} dirPath path to directory
 * @returns string | undefined
 */
const ensureDirSync = (dirPath) => {
    if (!dirPath) {
        return;
    }
    if (process?.platform === WIN_32 && PATH_REGEX?.test(dirPath?.replace(path?.parse(dirPath)?.root, ''))) {
        console.log('[EINVAL] Invalid log path. path contains invalid characters:', dirPath);
        return;
    }
    if (fs.existsSync(dirPath)) {
        return;
    }
    return fs.mkdirSync(dirPath, {
        recursive: true,
        mode: DIR_MODE  // this option not suported on window
    });
}

module.exports = {
    getPrettifiedStream,
    toFileNameCase,
    ensureDirSync
}
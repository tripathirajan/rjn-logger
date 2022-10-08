# @rjn/logger


![Logo](/logo-rjn-logger.png?raw=true "logo")

This package built using [pino][pino] logger, [pino-pretty][pino-pretty] and [pino-multi-stream][pino-multi-stream]. As *pino-multi-stream* package is deprecated, so in ``@rjn/logger``
we have pick that feature and combined ``pino`` and ``pino-multi-stream`` in a single package which allow us to use multiple streams for different ``log-levels``.

+ [Install](#install)
+ [How to use](#usage)

<a id="install"></a>
## Install
 to install this package use one of following command:
 
 ```js
 npm install https://github.com/tripathirajan/rjn-logger.git
 ```
or
```js
yarn add https://github.com/tripathirajan/rjn-logger.git
```
<a id="usage"></a>
## How to use

After installation you have to create a ``loggerConfig.js`` file at root of your project and add following configuration:
```js
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
            maxLogs: '10d',
            frequency: '24h',
            size: '1m',
            dateFormat: 'YYYY-MM-DD',
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
```
Here in config we have two major section ``targets`` and ``rules``. Those who have worked on Nlog (in .net) should familiar with this pattern, we have used same configurtion pattern. lets understand the each sections.
1. ``Targets`` : this section contains the output of logs like what type of output mode we have. Here we have ``console``, ``file``, ``remote``, and ``elastic``. 
+ ``Console``: here we allow configuration of pino-pretty like ``colorize``, ``singleLine``
+ `` file ``: here we allow configuration for log files like ``fileName pattern``, ``ext`` (file extesion) etc. we can also add pretty config by adding ``prettyConfig:{}``
+ ``Remote`` : this feature not implemented yet it is in WIP, this target is to post log to any url.
+ ``Elastic``: this feature not implemented yet, it is in WIP, this target to post logs on elastic directly.

2. ``Rules``: rules are basically to decide the for which loglevel and loggername what will be target. By default loggerName specified `` *`` which means it will aplly for all logger and all log levels. If we need to specify for a perticular logger to generate separae file we have to add in rule as:
```js
{ loggerName:'App' level:'error', outputMode:'file,console'}
```
Then for logger *App* and loglevel ``error`` it will generate separate log file and post log to remote target.

3. ``logDir``: default log directory name.

4. `` disableLogger ``: this feature not implemented yet.

Now we have completed the configuration part now here are the rest of steps: 
Step 1 (a). Add middleware first in the root file like ``app.js`` or ``server.js`` or ``index.js`` whatever is your root file
```js
const express = require('express');
const loggerMiddleware = require('@rjn/logger/loggerMiddleware');
.
.
const app = express();
app.use(loggerMiddleware);
```
This is to get request information in case of loging error for ``logger.debug`` and ``logger.error()``

Step 1 (b). require logmanager in your file where you want to use the logger:
```js
const logManager = require('@rjn/logger');
const appLogger = logManager.getLogger('App');
```
here you have to pass logger name ``getLogger(loggerName)``, by default it is ``logger``
you can create multiple instance of logger as:

```js
const logManager = require('@rjn/logger');
const appLogger = logManager.getLogger('App');
const uploadLogger = logManager.getLogger('Upload');
```
Step 2. add your logger
```js
appLogger.info('App running') // [18:29:11.000] INFO (89643): App running

// log error 

app.get('/test', (req, res, next) => {
    try {
        const d = x / 0;
    } catch (error) {
        appLogger.error(error);
    }
    res.send('hello')
});
// here log will be generated in logs/Error-2022-10-08.log
/*
[2022-10-08 6:29:15] ERROR (89643 on Rajans-MacBook-Air.local):  x is not defined 
 Request= {"req":"GET","path":"/test","query":{},"params":{},"host":"localhost:2345"} 
 Server = {"ip":"::1","servertime":"2022-10-08 18:29:15"} 
 User = null 
 Message =  
 File = app.js 11:19 
 ErrorType = ReferenceError 
 Stack = ReferenceError: x is not defined
    at /Users/rajan/Desktop/testApp/app.js:11:19
    ......
*/
```
### Future Scope:

+ Bug-fix
+ Speed test
+ Post logs to url
+ Post log to elastic
+ Disable loggers by specifying ``env`` or ``loggerConfig.js``
+ Convert to complete ``TypeScript`` package  

[pino]: https://npm.im/pino
[pino-multi-stream]: https://npm.im/pino-multi-stream
[pino-pretty]:https://www.npmjs.com/package/pino-pretty

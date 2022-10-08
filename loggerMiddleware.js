module.exports.loggerMiddleware = (req, res, next) => {
    global.reqInfo = req;
    next();
}
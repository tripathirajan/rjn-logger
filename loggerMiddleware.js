module.exports = (req, res, next) => {
    global.reqInfo = req;
    next();
}
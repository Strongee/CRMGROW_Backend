const checkAuth = async (req, res, next) => {
    next()
}

const checkAdmin = async (req, res, next) => {
    next()
}

module.exports = {
    checkAuth,
    checkAdmin
}
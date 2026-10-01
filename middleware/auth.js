const jwt = require('jsonwebtoken');

// Verifies token and extracts user ID, role, and managerId scope
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. Token missing.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        req.user = decoded; // { id, role, managerId }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    }
};

// Restricts route access based on allowed roles
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access forbidden: Unauthorized action for your role.' });
        }
        next();
    };
};

module.exports = { authenticate, authorize };
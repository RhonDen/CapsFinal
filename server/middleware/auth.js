const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  let token = req.cookies?.admin_token;

  // Keep a bearer-token fallback for tooling or backwards compatibility.
  if (!token) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

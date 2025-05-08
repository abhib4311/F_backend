const STATIC_TOKEN ="0b45c9e7f3f25ea55fc33c1f8b6dd1d1cbb6fffbf08aa4c79a78088a7b379da2"; 

export const verifyStaticToken = (req, res, next) => {
    console.log("req.headers",req.headers);
    
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];

  if (!token || token !== STATIC_TOKEN) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  next();
};


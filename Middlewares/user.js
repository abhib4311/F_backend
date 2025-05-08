import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

// Middleware to verify JWT token
const authenticateUser = async (req, res, next) => {
  try {
    // console.log("hii");
    let token;
    if (req.cookies && req.cookies.user_jwt) {
      token = req.cookies.user_jwt;
      console.log(token);
    }
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    // console.log("token-->", token);
    if (!token) {
      return res.status(401).json({ message: "not authorised" });
    }
    // Verify token
    const decoded = jwt.verify(token, process.env.USER_JWT);
    console.log("user_jwt-->", decoded);
    // Check if user exists
    console.log("decoded-->", decoded);
    const user = await prisma.customer.findUnique({
      where: { id: decoded.id, is_active: true },
    });

    if (!user)
      return res
        .status(401)
        .json({ message: "User not found. or user have been blocked" });

    req.user = user;
    next();
  } catch (error) {
    console.log("Error-->", error);
    return res.status(403).json({ message: "Invalid or expired token." });
  }
};

export default authenticateUser;

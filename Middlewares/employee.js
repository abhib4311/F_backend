import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

// Middleware to verify JWT token and user role
const authenticateEmployee = async (req, res, next) => {
  console.log("req.cookies-->", req.cookies);
  console.log("req.headers-->", req.headers);
  try {
    let token;
    if (req.cookies && req.cookies.employee_jwt) {
      token = req.cookies.employee_jwt;
    }
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    console.log("token-->", token);
    if (!token) {
      return res.status(401).json({ message: "not authorised" });
    }
    // Verify token
    const decoded = jwt.verify(token, process.env.CRM_JWT);
    // console.log("decoded-->", decoded);
    // Check if user exists
    const employee = await prisma.employee.findUnique({
      where: { id: decoded.id },
      include: { roles: { include: { role: true } } },
    });

    if (!employee) return res.status(401).json({ message: "User not found." });
    // Attach roles to request
    req.employee = employee;
    req.employee.roles = employee.roles.map((role) => role.role.role_name);
    const requestedRole = req.query?.role;
    // if (!requestedRole || !req.employee.roles.includes(requestedRole)) {
    //   return res.status(403).json({
    //     message: "You do not have the required permissions for this role",
    //   });
    // }
    req.activeRole = requestedRole;
    console.log(req.employee.roles)
    next();
  } catch (error) {
    console.log("Error-->", error);
    return res.status(403).json({ message: "Invalid or expired token." });
  }
};

// Role-based authorization middleware
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.employee || !req.employee.roles) {
      return res
        .status(403)
        .json({ message: "Access Denied. No roles assigned." });
    }

    const hasRole = req.employee.roles.some((role) =>
      allowedRoles.includes(role)
    );
    if (!hasRole) {
      return res
        .status(403)
        .json({ message: "Access Denied. Insufficient permissions." });
    }

    next();
  };
};

export { authenticateEmployee, authorizeRoles };
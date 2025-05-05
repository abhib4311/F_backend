import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { sendEmailOtpAPI, verifyEmailOtpAPI } from "../../service/thirdParty.js";
import { handleThirdPartyResponse } from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

const prisma = new PrismaClient();

//create employee (for admin)
export const createEmployee = async (req, res) => {

  try {
    const { f_name, l_name, email, password, gender, mobile, roleNames } = req.body;

    const emailregex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    const mobileregex = /^[0-9]{10}$/;
    const passwordregex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

    if (!emailregex.test(email)) {
      return res.status(400).json({ message: "Invalid email address." });
    }


    if (!mobileregex.test(mobile)) {
      return res.status(400).json({ message: "Invalid mobile number." });
    }

    if (!passwordregex.test(password)) {
      return res.status(400).json({ message: "Password must contain at least 8 characters, including uppercase, lowercase, number and special character." });
    }

    const emp_id = Math.random().toString(36).substr(2, 9);

    if (
      !f_name ||
      !l_name ||
      !email ||
      !password ||
      !gender ||
      !mobile ||
      !roleNames
    ) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }

    // Check if employee already exists by email
    const existingEmployee = await prisma.employee.findUnique({
      where: { email },
    });
    if (existingEmployee) {
      return res
        .status(400)
        .json({ message: "Employee with this email already exists." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const roleNamesArray = Array.isArray(roleNames) ? roleNames : [roleNames];

    // Fetch role IDs based on role names
    const roles = await prisma.role.findMany({
      where: { role_name: { in: roleNamesArray } },
      select: { id: true },
    });

    // if (roles.length !== roleNamesArray.length) {
    //     return res.status(400).json({ message: "One or more roles do not exist." });
    // }

    // Create employee
    const employee = await prisma.employee.create({
      data: {
        emp_id,
        f_name,
        l_name,
        email,
        password: hashedPassword,
        gender,
        mobile,
        is_logged_in: false,
        roles: {
          create: roles.map(role => ({ role_id: role.id }))
        }
      },
      include: { roles: { include: { role: true } } }
    });

    const log = await prisma.employee_Logs.create({
      data: {
        employee_id: employee.id,
        remarks: `Employee ${employee.f_name} ${employee.l_name} created with roles: ${roleNames}.`,
      },
    });


    const employeeWithLogs = await prisma.employee.findUnique({
      where: { id: employee.id },
      include: {
        roles: { include: { role: true } },
        logs: true, // Include logs
      },
    });

    res.status(201).json({ message: "Employee created successfully", employee: employeeWithLogs.id, role: employeeWithLogs.roles[0].role, logs: employeeWithLogs.logs });




  } catch (error) {
    console.error("Create Employee Error:", error);
    res.status(500).json({ message: "Failed to create employee", error });
  }
};

//update employee (for admin)
export const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { f_name, l_name, email, mobile, roleNames } = req.body;

    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id: Number(id) },
    });
    if (!existingEmployee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    const roleNamesArray = Array.isArray(roleNames) ? roleNames : [roleNames];

    // Fetch role IDs based on role names
    const roles = await prisma.role.findMany({
      where: { role_name: { in: roleNamesArray } },
      select: { id: true },
    });
    // Fetch role IDs based on role names


    // if (roles.length !== roleNames.length) {
    //   return res
    //     .status(400)
    //     .json({ message: "One or more roles do not exist." });
    // }

    // Update Employee with new roles
    const updatedEmployee = await prisma.employee.update({
      where: { id: Number(id) },
      data: {
        f_name,
        l_name,
        email,
        mobile,
        roles: {
          deleteMany: {}, // Remove all old roles
          create: roles.map((role) => ({ role_id: role.id })),
        },
      },
      include: { roles: { include: { role: true } } },
    });

    res.status(200).json(updatedEmployee);
  } catch (error) {
    console.error("Error updating employee:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

//employee login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email or password is missing" });
    }

    //  Check if employee exists + include roles
    const employee = await prisma.employee.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } }, // Include roles
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    //  Check if password is correct
    const isPasswordValid = await bcrypt.compare(password, employee.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    //  Update employee's login status
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        is_logged_in: true,
        last_logged_in: new Date(),
      },
    });

    //  Create JWT Payload
    const userID = {
      id: employee.id,
      email: employee.email,
      roles: employee.roles.map((role) => role.role.role_name),
    };

    //  Generate JWT Token
    const token = jwt.sign(userID, process.env.CRM_JWT, { expiresIn: "3d" });

    await prisma.employee_Logs.create({
      data: {
        employee_id: employee.id,
        remarks: `Employee ${employee.f_name} ${employee.l_name} logged in.`,
      },
    });
    //  Response with data
    res.cookie(
      "employee_jwt",
      token,
      {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 day 
      }
    );

    res.status(200).json({
      message: "Logged in successfully",
      token,
      employee: {
        id: employee.id,
        roles: userID.roles,
        f_name: employee.f_name,
        l_name: employee.l_name
      }
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

//employee logout
export const logout = async (req, res) => {
  try {

    const employeeId = req.employee.id;
    console.log("id-->", employeeId);


    //  Update employee's login status
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        is_logged_in: false,
        last_logged_in: new Date()
      },
    });
    await prisma.employee_Logs.create({
      data: {
        employee_id: employeeId,
        remarks: `Employee ${employeeId} logged out.`,
      },
    });
    //  Clear cookie
    res.clearCookie("employee_jwt");

    res.status(200).json({ message: "Logged out successfully", employee: employeeId });
  } catch (error) {
    console.error("Error logging out:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getProfile = async (req, res) => {
  res.status(200).json({
    status: "success",
    data: req.employee,
  })
}

export const sendEmailOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await prisma.$transaction(async (prisma) => {
    // const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email) {
      return res.status(400).json({ message: "Please fill required details" });
    }

    // if (!emailRegex.test(email)) {
    //   return res.status(400).json({ message: "Invalid office email format" });
    // }

    const employee = await prisma.employee.findUnique({
      where: { email: email },
    });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const otpResponse = await sendEmailOtpAPI(email, employee.f_name);
    console.log(otpResponse);

    if (otpResponse?.statusCode != "101") {
      return handleThirdPartyResponse(res, otpResponse);
    }
    return res.status(200).json({
      message: otpResponse?.result?.message || "OTP sent successfully",
      request_id: otpResponse.requestId,
      email: employee.email,
    });
  });
});

export const verifyEmailOTP = asyncHandler(async (req, res) => {
  const { otp, request_id, email } = req.body;
  console.log(req.body)
  if (!otp || !request_id) {
    return res.status(400).json({ message: "OTP is required" });
  }

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const otpResponse = await verifyEmailOtpAPI(otp, request_id);

  if (otpResponse?.statusCode != "101") {
    return handleThirdPartyResponse(res, otpResponse);
  }

  return res.status(200).json({
    message: otpResponse?.result?.message || "OTP verified successfully",
    email: email,
  });

});

export const creteNewPassword = async (req, res) => {
  try {
    const { email, newpassword } = req.body;

    if (!email || !newpassword) {
      return res.status(400).json({ message: "Email or password is missing" });
    }

    // Validate password
    // const passwordregex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    // if (!passwordregex.test(newpassword)) {
    //   return res.status(400).json({
    //     message: "Password must contain at least 8 characters, including uppercase, lowercase, number and special character."
    //   });
    // }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { email },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newpassword, 10);

    // Update employee's password
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        password: hashedPassword,
      },
    });

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error creating new password:", error);
    res.status(500).json({ message: "Error creating new password" });
  }
};
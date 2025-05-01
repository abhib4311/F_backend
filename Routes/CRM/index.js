import express from "express";
const router = express.Router();
import employeeRoute from "./employeeRoute.js";
import leadRoute from "./leadRoute.js";
import adminDashboardRoute from "./adminDashboard.js";

router.use("/employee", employeeRoute);
router.use("/lead", leadRoute);
router.use("/adminDashboard", adminDashboardRoute);



export default router;
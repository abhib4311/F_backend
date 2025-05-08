import express from 'express';
import {
    getAdminDashboardStats
} from "../../controllers/CRM/adminDashboardController.js";
import { authenticateEmployee, authorizeRoles } from '../../Middlewares/employee.js';


const router = express.Router();

// router.get('/', authenticateEmployee, authorizeRoles('Admin'), getAdminDashboardStats);
router.get('/', getAdminDashboardStats);


export default router;

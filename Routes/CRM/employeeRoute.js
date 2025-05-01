import { Router } from 'express';
import { createEmployee, updateEmployee, login, logout, creteNewPassword, getProfile, sendEmailOTP, verifyEmailOTP } from '../../controllers/CRM/employeeController.js';
import { authenticateEmployee, authorizeRoles } from '../../Middlewares/employee.js';
const router = Router();

router.post('/create', authenticateEmployee, authorizeRoles('Admin'), createEmployee);
router.put('/update/:id', authenticateEmployee, authorizeRoles('Admin'), updateEmployee);
router.post('/login', login);
router.post('/logout', authenticateEmployee, logout);
// router.put('/create-new-password', authenticateEmployee, authorizeRoles('Admin', 'Screener', 'Credit-Analyst'), creteNewPassword);
router.get('/profile', authenticateEmployee, getProfile);
router.post('/send-otp', sendEmailOTP);
router.post('/verify-otp', verifyEmailOTP);
router.put('/change-password', creteNewPassword);

export default router;

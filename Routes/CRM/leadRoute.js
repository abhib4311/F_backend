import express from 'express';
import {
    // Lead Management Controllers
    fetchUnallocatedLeads,
    rejectLeadWithRemarks,
    fetchMyAllocatedLeads,
    fetchMyRejectedLeads,
    assignMultipleLeadsToEmployee,
    fetchMyDisbursedLeadsAsSales,
    // BRE Management Controllers
    fetchUnassignedBreRejectedLeads,
    fetchMyBreRejectedLeads,
    assignMultipleBreRejectedLeadsToSelf,
    rejectBreRejectedLeadManually,
    approveBreRejectedLeadManually,
    fetchMyManuallyRejectedLeads,
    fetchMyManuallyApprovedLeads,
    fetchMyDisbursedLeadsAsCreditAnalyst,
    fetchAllDisbursedLeadsWithDetails,
    fetchAllClosedLeadsWithDetails,
    uploadMarketingLeadsInBulk,
    fetchMyBrePendingLeads,
    getCustomerDetails,
    getLoanDetails,
    getBankDetails,
    getAddress,
    getDocument,
    presignedUrl,
    getReferenceDetails,
    getThirdPartyApiResponse,
    getLeadLogs,
    disbursed,
    uploadDocument,
    getBSAReport
} from '../../controllers/CRM/leadController.js';
import { authenticateEmployee, authorizeRoles } from '../../Middlewares/employee.js';
import upload, { handleMulterError } from '../../Middlewares/multer.js';
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateEmployee);

// ======================================================================
// ====================== Marketing Lead Management ======================
// ======================================================================

router.post('/bulk-upload', upload.single('file'), handleMulterError, uploadMarketingLeadsInBulk);

// ======================================================================
// ====================== New Lead Management ======================
// ======================================================================

router.get('/new-lead/:category?', authorizeRoles('ADMIN', 'SALES-OPS'), fetchUnallocatedLeads);
// Get leads that are allocated to the current employee, filtered by category
router.get('/allocated-leads/:category?', authorizeRoles('ADMIN', 'SALES-OPS'), fetchMyAllocatedLeads);
// Get leads that are allocated to the current employee, filtered by category
router.get('/my-bre-pending-leads', authorizeRoles('ADMIN', 'SALES-OPS'), fetchMyBrePendingLeads);
// Get rejected leads that were previously allocated to the current employee
router.get('/my-rejected-leads', authorizeRoles('ADMIN', 'SALES-OPS'), fetchMyRejectedLeads);
// Self-allocate multiple new leads to the current employee
router.post('/allocate-new-lead', authorizeRoles('ADMIN', 'SALES-OPS'), assignMultipleLeadsToEmployee);
// Reject a new lead by admin/SALES-OPS
router.post('/reject-new-lead/:id', authorizeRoles('ADMIN', 'SALES-OPS'), rejectLeadWithRemarks);
// My Disbursed Leads
router.get('/my-disbursed-lead', authorizeRoles('ADMIN', 'SALES-OPS'), fetchMyDisbursedLeadsAsSales);


// ======================================================================
// ====================== BRE Rejected Lead Management ======================
// ======================================================================

router.get('/bre-rejected', authorizeRoles('ADMIN', 'CREDIT-ANALYST'), fetchUnassignedBreRejectedLeads);
// // Get BRE rejected leads allocated to current employee
router.get('/bre-rejected/employee', authorizeRoles('ADMIN', 'CREDIT-ANALYST'), fetchMyBreRejectedLeads);
// // Self-assign multiple BRE rejected leads to credit analyst
router.post('/bre-rejected/assign', authorizeRoles('ADMIN', 'CREDIT-ANALYST'), assignMultipleBreRejectedLeadsToSelf);
// // Get leads that were manually approved by the current employee
router.get('/bre-rejected/manual-approved', authorizeRoles('ADMIN', 'CREDIT-ANALYST'), fetchMyManuallyApprovedLeads);
// // Get leads that were manually rejected by the current employee
router.get('/bre-rejected/manual-rejected', authorizeRoles('ADMIN', 'CREDIT-ANALYST'), fetchMyManuallyRejectedLeads);
// // Manually reject a BRE rejected lead after review
router.post('/bre-rejected/manual-reject/:id', authorizeRoles('ADMIN', 'CREDIT-ANALYST'), rejectBreRejectedLeadManually);
// // Manually approve a BRE rejected lead after review
router.post('/bre-rejected/manual-approve/:id', authorizeRoles('ADMIN', 'CREDIT-ANALYST'), approveBreRejectedLeadManually);
// // My Disbursed leads
router.get('/my-approved-disbursed-lead', authorizeRoles('ADMIN', 'CREDIT-ANALYST'), fetchMyDisbursedLeadsAsCreditAnalyst)

// // ======================================================================
// // ====================== Lead Status Management ======================
// // ======================================================================

router.get('/disbursed', fetchAllDisbursedLeadsWithDetails);
// Get all leads that have been closed
router.get('/closed', fetchAllClosedLeadsWithDetails);

// // ======================================================================
// // ====================== Lead Details & Utilities ======================
// // ======================================================================

router.get('/customer-detail/:id', authorizeRoles('ADMIN', 'CREDIT-ANALYST', 'SALES-OPS'), getCustomerDetails);
router.get('/loan-details/:id', authorizeRoles('ADMIN', 'CREDIT-ANALYST'), getLoanDetails);
router.get('/bank-details/:id', authorizeRoles('ADMIN', 'CREDIT-ANALYST', 'SALES-OPS'), getBankDetails);

// Third-party data and audit logs
router.get('/third-party-api-data/:id', authorizeRoles('ADMIN', 'CREDIT-ANALYST', 'SALES-OPS'), getThirdPartyApiResponse);
router.get('/lead-logs/:id', authorizeRoles('ADMIN', 'SALES-OPS'), getLeadLogs);

// Address and document management
router.get('/address/:id', authorizeRoles('ADMIN', 'CREDIT-ANALYST', 'SALES-OPS'), getAddress);
router.get('/documents/:id', authorizeRoles('ADMIN', 'CREDIT-ANALYST', 'SALES-OPS'), getDocument);

// Secure URL generation
router.get('/generate-presigned-url', authorizeRoles('ADMIN', 'SALES-OPS', 'CREDIT-ANALYST'), presignedUrl);

// Reference details
router.get('/reference-details/:id', authorizeRoles('ADMIN', 'CREDIT-ANALYST', 'SALES-OPS'), getReferenceDetails);
router.get('/bsa-report/:id', authorizeRoles('ADMIN', 'CREDIT-ANALYST', 'SALES-OPS'), getBSAReport);

// // ======================================================================
// // ====================== Disbursal Route ======================
// // ======================================================================
router.post("/manual-disbursed", authorizeRoles('CREDIT-ANALYST'), upload.single('paymentSS'), handleMulterError, disbursed);  // manual Disbursal
router.post("/document-upload/:id", upload.single('file'), handleMulterError, uploadDocument);  // manual Disbursal
// router.post("/document-upload/:id", authorizeRoles('CREDIT-ANALYST'), upload.single('file'), handleMulterError, uploadDocument);  // manual Disbursal

export default router;
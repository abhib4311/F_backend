import express from "express";
import {
  sendOTP,
  verifyOTP,
  sendEmailOTP,
  verifyEmailOTP,
  addEmployement,
  getJourney,
  logout,
  getUserProfile,
  requestLoan,
  requestLoanAmount
} from "../../controllers/User/auth.controller.js";
import { uploadBankStatement } from "../../controllers/User/bank.controller.js";
import {
  Initiatekyc,
  submitotp,
} from "../../controllers/User/kyc.controller.js";
import {
  getLoanDetails,
  previewSanction,
  redirectUrl,
  disbursed,
  getCongratulationPageDetails,
} from "../../controllers/User/sanction.controller.js";
import {
  applyReloan,
  getLoanStatus,
} from "../../controllers/User/reloan.controller.js";
import {
  sendFeedback,
  addReference,
} from "../../controllers/User/postLoan.controller.js";
import authenticateUser from "../../Middlewares/user.js";
import { faceMatchHandler } from "../../controllers/User/face.match.controller.js";
import { processBankStatement } from "../../controllers/User/process.bank.controller.js";
import { callbackBankStatement } from "../../controllers/User/callback.bank.statement.js";
import { sendEncryptedRequest } from "../../controllers/User/banking_integration.js"
import { verifyStaticToken } from "../../utils/verify_static_token.js";

import fileUpload from "express-fileupload";


const router = express.Router();


router.use(fileUpload());

// ---------------------------------------------------------------------------------//
// Onboarding (Step:1)
router.post("/send-otp", sendOTP); // Done
router.post("/verify-otp", verifyOTP); // Done
router.post("/add-employement", authenticateUser, addEmployement); // Done
router.post("/send-email-otp", authenticateUser, sendEmailOTP); // Done
router.post("/verify-email-otp", authenticateUser, verifyEmailOTP); // Done

// ---------------------------------------------------------------------------------//

// Upload Bank Statement (Step:2)
router.post("/upload-bank-statement", authenticateUser, uploadBankStatement);
// router.post("/upload-bank-statement", authenticateUser, uploadBankStatement); 
router.post("/process-bank-statement", authenticateUser, processBankStatement);
router.post(
  "/callback-bank-statement",
  verifyStaticToken,
  callbackBankStatement
);
router.get("/request-loan-amount" ,authenticateUser , requestLoanAmount)
router.post("/request-loan", authenticateUser, requestLoan); // Done

// ---------------------------------------------------------------------------------//
// E-KYC (Step:3)
router.post("/initiate-kyc", authenticateUser, Initiatekyc); // Done
// router.post("/initiate-kyc", Initiatekyc); // Done
router.post("/submit-aadhar-otp", authenticateUser, submitotp); // Done
router.post("/face-match", authenticateUser, faceMatchHandler);

// ---------------------------------------------------------------------------------//
// Preview Sanction (Step:4)
router.get("/loan-details", authenticateUser, getLoanDetails); // Done
router.post("/preview-sanction",
  authenticateUser,
  previewSanction); // Done
router.post("/redirect-url", authenticateUser, redirectUrl); // Done
// router.post("/disbursed", authenticateUser, disbursed); // BANK API
router.get(
  "/congratulation-page",
  authenticateUser,
  getCongratulationPageDetails
); // DOne

// ---------------------------------------------------------------------------------//
// Get-Journey (for managing user journey)
router.get("/loan-status", authenticateUser, getLoanStatus); // Done
router.post("/apply-reloan", authenticateUser, applyReloan); // Don
router.get("/get-journey", authenticateUser, getJourney); // Done
router.post("/logout", authenticateUser, logout); // Done
router.get("/profile", authenticateUser, getUserProfile); // Done
// router.post("/auto-payment", sendEncryptedRequest)
// router.post("/status-check", status_check)

// ---------------------------------------------------------------------------------//
// Post loan Routes
router.post("/submit-feedback", authenticateUser, sendFeedback); // Done
router.post("/add-refrence", authenticateUser, addReference); // Done

export default router;

// constants/urlConstants.js

export const API_PATHS = {
  SEND_OTP_MOBILE: "https://kyc-api.surepass.io/api/v1/telecom/generate-otp",
  VERIFY_OTP_MOBILE: "https://kyc-api.surepass.io/api/v1/telecom/submit-otp",
  VERIFY_PAN: "https://kyc-api.surepass.io/api/v1/pan/pan-comprehensive",
  SEND_AADHAR_OTP: "https://kyc-api.surepass.io/api/v1/aadhaar-v2/generate-otp",
  VERIFY_AADHAR_OTP: "https://kyc-api.surepass.io/api/v1/aadhaar-v2/submit-otp",
  UPLAOD_STATEMENT_FILE:
    "https://sandbox.surepass.io/api/v1/bank/statement/upload",
  DOWNLAOD_STATEMENT_FILE:
    "https://sandbox.surepass.io/api/v1/bank/statement/download",
  FACEMATCH_URL: "https://sandbox.surepass.io/api/v1/face/face-match",

  PROCESS_BANK_STMT: "https://cartuat.com/api/generateNetBankingRequest",
  CIBIL_URL: "https://bre.blinkrloan.com/v1/api/cibil",
};

export const Role = {
    ADMIN: "ADMIN",
    SCREENER: "SCREENER",

};

export const API_TYPE = {
    LOCATION_DETAILS: "LOCATION_DETAILS",
    PAN_DETAILS: "PAN_DETAILS",
    CREDIT_REPORT: "CREDIT_REPORT",
    AADHAAR_KYC: "AADHAAR_KYC",
    ESIGN_API: "ESIGN_API",
    DOWNLOAD_ESIGN: "DOWNLOAD_ESIGN",
    LOAN_DISBURSEMENT: "LOAN_DISBURSEMENT",
    BANK_STATEMENT_UPLOAD: "BANK_STATEMENT_UPLOAD",
    BANK_STATEMENT_DOWNLOAD: "BANK_STATEMENT_DOWNLOAD"
};

export const COUNTER = {
    LEAD_NO: "LEAD00000001",
    LOAN_NO: "LOAN00000001",

};

export const DOCUMENT_TYPE = {
    BANNK_STATEMENT: "BANNK_STATEMENT",
    SANCTION_LETTER: "SANCTION_LETTER",
    AADHAAR_IMAGE: "AADHAAR_IMAGE",
    AADHAAR: "AADHAAR",
    ADDITIONAL_DOCUMENT: "ADDITIONAL_DOCUMENT",
    BANK_STATEMENT_UPLOAD: "BANK_STATEMENT_UPLOAD",
    BANK_STATEMENT_DOWNLOAD: "BANK_STATEMENT_DOWNLOAD"
};

export const LEAD_STAGE = {
    PENDING_LEAD: "PENDING_LEAD",
    COMPLETE_REGISTRATION: "COMPLETE_REGISTRATION",
    BRE_APPROVED: "BRE_APPROVED",
    BRE_REJECT: "BRE_REJECT",
    LOAN_REQUESTED: "LOAN_REQUESTED",
    SEND_AADHAAR_OTP: "SEND_AADHAAR_OTP",
    VERIFY_AADHAAR_KYC: "VERIFY_AADHAAR_KYC",
    REJECT_AADHAR_KYC: "REJECT_AADHAR_KYC",
    SEND_EMAIL_OTP: "SEND_EMAIL_OTP",
    VRIFY_EMAIL_OTP: "VRIFY_EMAIL_OTP",
    ADD_EMPLOYEMENT: "ADD_EMPLOYEMENT",
    PENDING_EMPLOYEMENT: "PENDING_EMPLOYEMENT_WITH_SELF_EMPLOYEED",
    SANCTION_PENDING: "SANCTION_PENDING",
    SANCTION_COMPLETED: "SANCTION_COMPLETED",
    DISBURSED: "DISBURSED",
    DISBURSAL_FAILED: "DISBURSAL_FAILED",
    APPLY_RELOAN: "APPLY_RELOAN",
    MANUALLY_REJECT: "MANUALLY_REJECT",
    MANUALLY_APPROVE: "MANUALLY_APPROVE"
}

export const SOURCE = {
    FUNDO_APP: "FUNDO_APP",
    FUNDO_WEB: "FUNDO_WEB",
    SQUID_LOAN: "SQUID_LOAN",
    MARKETING: "MARKETING",
    APP: "APP"
}

export const Employee_Type = {
    SALARIED: "SALARIED",
    SELF_EMPLOYED: "SELF_EMPLOYED"
}

export const ADDRESS_SOURCE = {
    AADHAAR: "AADHAAR",
    GEO_LOCATION: "GEO_LOCATION",
    BSA: "BSA",
    CIBIL: "CIBIL",
    ON_GRID: "ON_GRID"
}

export const STATE_CODE_MAP = {
    1: "Jammu & Kashmir",
    2: "Himachal Pradesh",
    3: "Punjab",
    4: "Chandigarh",
    5: "Uttaranchal/Uttarakhand",
    6: "Haryana",
    7: "Delhi",
    8: "Rajasthan",
    9: "Uttar Pradesh",
    10: "Bihar",
    11: "Sikkim",
    12: "Arunachal Pradesh",
    13: "Nagaland",
    14: "Manipur",
    15: "Mizoram",
    16: "Tripura",
    17: "Meghalaya",
    18: "Assam",
    19: "West Bengal",
    20: "Jharkhand",
    21: "Orissa",
    22: "Chhattisgarh",
    23: "Madhya Pradesh",
    24: "Gujarat",
    25: "Daman & Diu",
    26: "Dadra & Nagar Haveli and Daman & Diu",
    27: "Maharashtra",
    28: "Andhra Pradesh",
    29: "Karnataka",
    30: "Goa",
    31: "Lakshadweep",
    32: "Kerala",
    33: "Tamil Nadu",
    34: "Pondicherry",
    35: "Andaman & Nicobar Islands",
    36: "Telangana",
    38: "Ladakh",
    99: "APO Address",
};

export const COUNTRY = {
    INDIA: "INDIA",
}

// -------------------------------------
/*
1. add address document. --> aashish 
2. swap cibil in verify OTP -->  Uvesh
3. add caseID --> priyanshu
4. sanction module --> sachin
5. optimize all queries --> Uvesh
*/

function getStateCodeByName(stateName) {
    const entry = Object.entries(STATE_CODE_MAP).find(([code, name]) => name === stateName);
    return entry ? entry[0] : "99";
}
// console.log("----->" , getStateCodeByName("Descxbclhi"))
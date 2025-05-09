
import moment from "moment";
import NameMatcher from '../utils/name-matcher.mjs';


const nameMatcher = new NameMatcher({
  weights: { dice: 0.4, jaro: 0.4, levenshtein: 0.2, phonetic: 0.0 },
});

export const standardizeDOB = (dob) => {
  const formats = ["DD-MM-YYYY", "YYYY-MM-DD", "DD/MM/YYYY", "YYYY/MM/DD"];
  for (const format of formats) {
    const parsedDate = moment(dob, format, true);
    if (parsedDate.isValid()) {
      return parsedDate.format("YYYY-MM-DD");
    }
  }
  return null;
};

export const validatePANwithAadhaar = (panData, aadhaarData, bankData) => {
  const mismatches = [];
  const result = {
    nameMatchScore: "",
    isValid: true,
    kycStatus: "Verified",
    aadhaarLinked: false,
    profileMatches: {
      dob: false,
      gender: false,
      name: false
    },
    mismatchReasons: [],
  };

  try {
    result.aadhaarLinked = panData.data?.aadhaar_linked === true;
    const aadhaarMatch = panData.data?.aadhaar_linked;

    if (!result.aadhaarLinked) {
      mismatches.push("PAN not linked with Aadhaar");
    }
    if (aadhaarMatch === false) {
      mismatches.push("PAN-Aadhaar details mismatch");
    }

    const aadhaarDOB = standardizeDOB(aadhaarData?.data?.dob);
    const panDOB = standardizeDOB(panData.data?.dob);

    result.profileMatches.dob = aadhaarDOB === panDOB;
    if (!result.profileMatches.dob) {
      mismatches.push(`DOB mismatch: Aadhaar(${aadhaarDOB}) vs PAN(${panDOB})`);
    }

    const genderMap = { F: "F", M: "M" };
    const aadhaarGender =
      genderMap[aadhaarData?.data?.gender] || "";
    const panGender = (panData.data?.gender || "").toUpperCase();

    result.profileMatches.gender = aadhaarGender === panGender;
    if (!result.profileMatches.gender) {
      mismatches.push(
        `Gender mismatch: Aadhaar(${aadhaarGender}) vs PAN(${panGender})`
      );
    }
    // Name validation with bank account
    const names = {
      aadhaar: aadhaarData?.data?.full_name,
      pan: panData.data?.full_name,
      bank: bankData?.beneficiary_name
    };
    const nameResult = nameMatcher.matchDocuments(names);
    result.profileMatches.name = nameResult.overallScore >= 0.75;

    if (!result.profileMatches.name) {
      mismatches.push(`Name match score: ${(nameResult.overallScore * 100).toFixed(1)}%`);
      Object.entries(nameResult.comparisons).forEach(([pair, { score }]) => {
        if (score < 0.75) {
          mismatches.push(`${pair.replace('-', ' vs ')}: ${(score * 100).toFixed(1)}%`);
        }
      });
    }

    result.isValid = mismatches.length === 0 && result.aadhaarLinked;
    result.kycStatus = result.isValid ? "Verified" : "Failed";
    result.mismatchReasons = mismatches;
    result.nameMatchScore = `Name match score: ${(nameResult.overallScore * 100).toFixed(1)}%  
    1.AadhaarName : ${aadhaarData?.data?.full_name} 
    2.PAN name :${panData.data?.name} 
    3.Bank Name :${bankData?.beneficiary_name}`
  } catch (error) {
    console.error("Validation error:", error);
    result.isValid = false;
    result.kycStatus = "Validation Error";
    result.mismatchReasons.push("Error processing KYC data");
  }

  return result;
};


// import moment from "moment";

// export const standardizeDOB = (dob) => {
//   const formats = ["DD-MM-YYYY", "YYYY-MM-DD", "DD/MM/YYYY", "YYYY/MM/DD"];
//   for (const format of formats) {
//     const parsedDate = moment(dob, format, true);
//     if (parsedDate.isValid()) {
//       return parsedDate.format("YYYY-MM-DD");
//     }
//   }
//   return null;
// };

// export const validatePANwithAadhaar = (panData , aadhaarData) => {
//   const mismatches = [];
//   const result = {
//     isValid: true,
//     kycStatus: "Verified",
//     aadhaarLinked: false,
//     profileMatches: {
//       dob: false,
//       gender: false,
//     },
//     mismatchReasons: [],
//   };

//   try {
//     console.log("------->STEP !");
//     result.aadhaarLinked = panData?.data?.aadhaar_linked === true;
//     // const aadhaarMatch = panData?.data?.aadhaarMatch;

//     if (!result.aadhaarLinked) {
//       mismatches.push("PAN not linked with Aadhaar");
//     }
//     // if (aadhaarMatch === false) {
//     //   mismatches.push("PAN-Aadhaar details mismatch");
//     // }
//     console.log("------->STEP 2");
//     const aadhaarDOB = standardizeDOB(aadhaarData?.data?.dob);
//     const panDOB = standardizeDOB(panData?.data?.dob);

//     result.profileMatches.dob = aadhaarDOB === panDOB;
//     if (!result.profileMatches.dob) {
//       mismatches.push(`DOB mismatch: Aadhaar(${aadhaarDOB}) vs PAN(${panDOB})`);
//     }
//     console.log("------->STEP 3");
//     const genderMap = { F: "FEMALE", M: "MALE" };
//     const aadhaarGender =
//       genderMap[aadhaarData?.data?.gender] || "";
//     const panGender = genderMap[panData?.data?.gender] || "";
//     console.log("------->STEP 4");
//     result.profileMatches.gender = aadhaarGender === panGender;
//     if (!result.profileMatches.gender) {
//       mismatches.push(
//         `Gender mismatch: Aadhaar(${aadhaarGender}) vs PAN(${panGender})`
//       );
//     }
//     console.log("------->STEP 5");
//     result.isValid = mismatches.length === 0 && result.aadhaarLinked;
//     result.kycStatus = result.isValid ? "Verified" : "Failed";
//     result.mismatchReasons = mismatches;
//     console.log("------->STEP 6",mismatches,);
//   } catch (error) {
//     console.error("Validation error:", error,result.aadhaarLinked);
//     result.isValid = false;
//     result.kycStatus = "Validation Error";
//     result.mismatchReasons.push("Error processing KYC data");
//   }

//   return result;
// };


/*
//---------- Expected Output -------------
{
    "isValid": false,
    "kycStatus": "Failed",
    "aadhaarLinked": false,
    "profileMatches": {
        "name": false,
        "dob": false,
        "gender": true
    },
    "mismatchReasons": [
        "PAN not linked with Aadhaar",
        "Name mismatch: Aadhaar(John Doe) vs PAN(Jon Doe)",
        "DOB mismatch: Aadhaar(1990-05-10) vs PAN(1991-05-10)"
    ]
}

*/

// const panDetails = { "data": { "dob": "2002-04-20", "email": null, "gender": "M", "status": "valid", "address": { "zip": "", "city": "", "full": "", "state": "", "line_1": "", "line_2": "", "country": "", "street_name": "" }, "category": "person", "client_id": "pan_comprehensive_rOAsqcprkyscTcxlDJgg", "dob_check": false, "full_name": "AYUSH DIXIT", "input_dob": null, "less_info": false, "pan_number": "FSPPD4469E", "dob_verified": false, "phone_number": null, "aadhaar_linked": true, "masked_aadhaar": "XXXXXXXX8328", "full_name_split": ["AYUSH", "", "DIXIT"] }, "message": null, "success": true, "status_code": 200, "message_code": "success" }
// const aadhaarDetails = { "data": { "dob": "2002-04-20", "zip": "274001", "gender": "M", "status": "success_aadhaar", "address": { "po": "Deoria", "loc": "", "vtc": "Deoria", "dist": "Deoria", "house": "665 Ward No 13", "state": "Uttar Pradesh", "street": "Uma Nagar", "country": "India", "subdist": "Bhatpar Rani", "landmark": "" }, "care_of": "C/O: Satendra Kumar Dixit", "raw_xml": "https://aadhaar-kyc-docs.s3.amazonaws.com/fintechcloud/aadhaar_xml/832820250509001725851/832820250509001725851-2025-05-08-184726447236.xml?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAY5K3QRM5FYWPQJEB%2F20250508%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Date=20250508T184726Z&X-Amz-Expires=432000&X-Amz-SignedHeaders=host&X-Amz-Signature=5ab7a2565ce474a8a22716a54b95d430ae72fb6d7fcd5391a5be93166c2cf0f3", "zip_data": "https://aadhaar-kyc-docs.s3.amazonaws.com/fintechcloud/aadhaar_xml/832820250509001725851/832820250509001725851-2025-05-08-184726346783.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAY5K3QRM5FYWPQJEB%2F20250508%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Date=20250508T184726Z&X-Amz-Expires=432000&X-Amz-SignedHeaders=host&X-Amz-Signature=f806ca06fa125766afdf7b54aadca3ed3e7521b983e02ac136c9453206e8b371", "client_id": "aadhaar_v2_ugnoxedpoMmpYfrxmoft", "full_name": "Ayush Dixit", "has_image": true, "email_hash": "", "face_score": -1, "share_code": "7187", "aadhaar_pdf": null, "face_status": false, "mobile_hash": "5b4c5a0f8d7218802754aaf648bae1647a881e0d7071e28707efb022da84e680", "reference_id": "832820250509001725851", "uniqueness_id": "57cceb3662f21fb38fa9333fa9cd3fbcb93d4708b12b9811e7e7f2796d4d8571", "aadhaar_number": "XXXXXXXX8328", "mobile_verified": false }, "message": null, "success": true, "status_code": 200, "message_code": "success" }
// const bankDetails = {
//   beneficiary_name: "Mr. Ayush Dixit",
// }
// // console.log(panDetails, aadhaarDetails, bankDetails)
// console.log(validatePANwithAadhaar(panDetails, aadhaarDetails, bankDetails))
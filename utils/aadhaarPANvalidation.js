
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
    result.aadhaarLinked = panData.result?.aadhaarLinked === true;
    const aadhaarMatch = panData.result?.aadhaarMatch;

    if (!result.aadhaarLinked) {
      mismatches.push("PAN not linked with Aadhaar");
    }
    if (aadhaarMatch === false) {
      mismatches.push("PAN-Aadhaar details mismatch");
    }

    const aadhaarDOB = standardizeDOB(aadhaarData?.data?.dob);
    const panDOB = standardizeDOB(panData.result?.dob);

    result.profileMatches.dob = aadhaarDOB === panDOB;
    if (!result.profileMatches.dob) {
      mismatches.push(`DOB mismatch: Aadhaar(${aadhaarDOB}) vs PAN(${panDOB})`);
    }

    const genderMap = { F: "FEMALE", M: "MALE" };
    const aadhaarGender =
      genderMap[aadhaarData?.data?.gender] || "";
    const panGender = (panData.result?.gender || "").toUpperCase();

    result.profileMatches.gender = aadhaarGender === panGender;
    if (!result.profileMatches.gender) {
      mismatches.push(
        `Gender mismatch: Aadhaar(${aadhaarGender}) vs PAN(${panGender})`
      );
    }
    // Name validation with bank account
    const names = {
      aadhaar: aadhaarData?.data?.full_name,
      pan: panData.result?.name,
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
    2.PAN name :${panData.result?.name} 
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

// const panDetails = {
//   "result": {
//     "dob": "1990-05-15",
//     "name": "RAJESH KUMAR SINGH",
//     "gender": "MALE",
//     "aadhaarLinked": true,
//     "aadhaarMatch": true
//   }
// }
// const aadhaarDetails = {
//   result: {
//     dataFromAadhaar: {
//       name: "Rajesh Kumar Singh",
//       dob: "15-05-1990",
//       gender: "M"
//     }
//   }
// }
// const bankDetails = {
//   beneficiary_name: "Uvesh",
// }
// // console.log(panDetails, aadhaarDetails, bankDetails)
// console.log(validatePANwithAadhaar(panDetails, aadhaarDetails, bankDetails))
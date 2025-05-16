import axios from "axios";
import dotenv from "dotenv";
import { ResponseError } from "../utils/responseError.js";
import { API_PATHS } from "../constants/urlConstants.js";
import { handleSurepassResponse } from "../utils/apiResponse.js";
dotenv.config();

//  Send OTP API
export const sendOtpAPI = async (phone_number) => {
  try {
    // <<<---------MY CODE BEGINS FROM HERE ---------->>>>>>>
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", process.env.SURE_PASS_ACCESS_TOKEN_PRODUCTION_PRODUCTION);

    const raw = JSON.stringify({
      id_number: phone_number,
    });

    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };

    const response = await fetch(
      API_PATHS.SEND_OTP_MOBILE,
      requestOptions
    );
    const result = await response.json();
    return result;
  } catch (error) {
    if (error.response) {
      console.log("Send OTP API Error:", error.response?.data?.message);
      handleSurepassResponse(error.response?.data);
    } else {
      console.log("Send OTP API Error:", error.message);
      throw new ResponseError(500, error.message || "Failed to connect to the third party API to send OTP");
    }
  }
};  // SUREPASS OTP API
// };  // SUREPASS OTP API


// Verify OTP API
export const verifyOtpAPI = async (otp, request_id) => {
  try {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", process.env.SURE_PASS_ACCESS_TOKEN_PRODUCTION_PRODUCTION);

    const raw = JSON.stringify({
      client_id: request_id,
      otp: otp,
    });

    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };

    const response = await fetch(
      API_PATHS.VERIFY_OTP_MOBILE,
      requestOptions
    );
    const result = await response.json();
    return result;
  } catch (error) {
    if (error.response) {
      console.log("Verify OTP API Error:", error.response?.data?.message);
      handleSurepassResponse(error.response?.data);
    } else {
      console.log("Verify OTP API Error:", error.message);
      throw new ResponseError(500, error.message || "Failed to connect to the third party API to verify OTP");
    }
  }
}; // SUREPASS OTP API
// }; // SUREPASS OTP API

// Fetch Mobile Details API
export const fetchMobileDetailsAPI = async (request_id) => {
  try {
    let data = JSON.stringify({
      request_id: request_id,
    });

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: process.env.FETCH_MOBILE_DETAILS,
      headers: {
        "x-karza-key": process.env.KARZA_API_KEY,
        "Content-Type": "application/json",
      },
      data: data,
    };

    const response = await axios.request(config);
    return { mobileResponse: response.data, mobileRequest: config };
  } catch (error) {
    console.error("Fetch Mobile details API Error:", error);
    if (error.response) {
      console.log("Verify OTP error", error)
      throw new ResponseError(
        error.response.status || 500,
        error.response.data?.error || 'Third-Party API returned an error'
      );
    } else {
      throw new ResponseError(
        500,
        error.message || 'Failed to connect to the third party API to fetch mobile details'
      );
    }
  }
}; // PERFIOS API
// }; // PERFIOS API

// Fetch PAN Details API
export const fetchPanDetailsAPI = async (PAN) => {
  try {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", process.env.SURE_PASS_ACCESS_TOKEN_PRODUCTION_PRODUCTION);

    const raw = JSON.stringify({
      id_number: PAN,
    });

    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };

    const response = await fetch(API_PATHS.VERIFY_PAN, requestOptions);
    const result = await response.json();
    console.log('fetchPanDetailsAPI', result);
    return {
      panResponse: result,
      panRequest: {
        method: requestOptions.method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": process.env.SURE_PASS_ACCESS_TOKEN,
        },
        body: raw,
        redirect: requestOptions.redirect,
      }
    };

    // return { panResponse: result, panRequest: requestOptions };
  } catch (error) {
    if (error.response) {
      console.log("Fetch PAN details API Error:", error.response?.data?.message);
      handleSurepassResponse(error.response?.data);
    } else {
      console.log("Fetch PAN details API Error:", error.message);
      throw new ResponseError(500, error.message || "Failed to connect to the third party API to get PAN details");
    }
  }
}; // SUREPASS PAN API
// }; // SUREPASS PAN API

// Send OTP on Email
export const sendEmailOtpAPI = async (email, employeeName) => {
  console.log(email);
  try {
    let data = JSON.stringify({
      email: email,
      config: {
        trackerEnabled: true,
        expiryInMinutes: 15,
        otpRetryLimit: 5,
        fraudCheck: true,
      },

      notification: {
        webhook: true,
      },
    });
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: process.env.EMAIL_OTP,
      headers: {
        "x-karza-key": process.env.KARZA_API_KEY,
        "Content-Type": "application/json",
      },
      data: data,
    };

    // console.log("congig------>", config)
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.log("Send Email OTP API Error:", error?.message);
    if (error.response) {
      throw new ResponseError(
        error.response.status || 500,
        error.response.data?.error || 'Third-Party API returned an error'
      );
    } else {
      throw new ResponseError(
        500,
        error.message || 'Failed to connect to the third party API to send email OTP'
      );
    }
  }
}; //PERFIOS API
// }; //PERFIOS API

// Verif Email OTP
export const verifyEmailOtpAPI = async (otp, request_id) => {
  try {
    let data = JSON.stringify({
      otp: otp,
      requestId: request_id,
    });

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: process.env.VALIDATE_EMAIL_OTP,
      headers: {
        "x-karza-key": process.env.KARZA_API_KEY,
        "Content-Type": "application/json",
      },
      data: data,
    };

    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.error("Verify Email OTP API Error:", error);
    if (error.response) {
      throw new ResponseError(
        error.response.status || 500,
        error.response.data?.error || 'Third-Party API returned an error'
      );
    } else {
      throw new ResponseError(
        500,
        error.message || 'Failed to connect to the third party API to verify email OTP'
      );
    }
  }
};  // PERFIOS API

export const sendAadhaarOtpAPI = async (aadhaar) => {
  try {
    let data = JSON.stringify({
      aadhaarNo: aadhaar,
      consent: "Y",
    });

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: process.env.SEND_AADHAAR_OTP,
      headers: {
        "x-karza-key": process.env.KARZA_API_KEY,
        "Content-Type": "application/json",
      },
      data: data,
    };

    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.error("Send Aadhaar OTP API Error:", error);
    if (error.response) {
      throw new ResponseError(
        error.response.status || 500,
        error.response.data?.error || 'Third-Party API returned an error'
      );
    } else {
      throw new ResponseError(
        500,
        error.message || 'Failed to connect to the third party API to send Aadhaar OTP'
      );
    }
  }
};  //PERFIOS API
// };  //PERFIOS API

// Validate Aadhaar API
export const validateAadhaarOtpAPI = async (otp, accessKey, aadhaarNo) => {
  try {
    let data = JSON.stringify({
      otp: otp,
      accessKey: accessKey,
      aadhaarNo: aadhaarNo,
      consent: "Y",
    });

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: process.env.VALIDATE_ADDHAAR_OTP,
      headers: {
        "x-karza-key": process.env.KARZA_API_KEY,
        "Content-Type": "application/json",
      },
      data: data,
    };
    const response = await axios.request(config);
    return { aadhaarRequest: config, aadhaarResponse: response.data };
  } catch (error) {
    console.error("Validate Aadhaar OTP API Error:", error);
    if (error.response) {
      throw new ResponseError(
        error.response.status || 500,
        error.response.data?.error || 'Third-Party API returned an error'
      );
    } else {
      throw new ResponseError(
        500,
        error.message || 'Failed to connect to the third party API to validate Aadhaar OTP'
      );
    }
  }
};  //PERFIOS API
// };  //PERFIOS API

export const fetchOnGridAddress = async (mobile) => {
  try {
    const options = {
      method: 'POST',
      url: process.env.FETCH_ON_GRID_ADDRESS,
      headers: {
        'X-Auth-Type': 'API-Key',
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Key': process.env.X_API_KEY
      },
      data: { mobile_number: mobile, consent: 'Y' }
    };

    const response = await axios.request(options);
    const resData = response.data;

    if (resData.status === 200) {
      if (resData.data.code === "1002") {
        return {
          onGridRequest: options,
          onGridResponse: resData,
        }
      } else if (resData.data.code === "1004") {
        return {
          onGridRequest: options,
          onGridResponse: {},
        }
      }
    }

    // Fallback for unexpected response
    throw new ResponseError(500, "Unexpected response from OnGrid API.");

  } catch (error) {
    console.error("Fetch On Grid Address API Error:", error.message);

    const errorResponse = error.response?.data;

    const message =
      errorResponse?.message ||
      errorResponse?.error ||
      error.message ||
      "Third-Party API Failure";

    const statusCode = error.response?.status || 500;

    console.error("Full error response:", JSON.stringify(errorResponse, null, 2));

    throw new ResponseError(statusCode, message);
  }
};  //ONGRID API
// };  //ONGRID API


// esign document return API


export const fetchCibilAPI = async (cibilRequestBody) => {
  try {
    const data = JSON.stringify({
      mobile: cibilRequestBody.mobile,
      pan: cibilRequestBody.pan,
      name: cibilRequestBody.name,
      gender: cibilRequestBody.gender,
      consent: "Y"
    });

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: process.env.FETCH_CREDIT_REPORT,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.SURE_PASS_ACCESS_TOKEN_PRODUCTION_PRODUCTION
      },
      data: data
    };

    const cibilResponse = await axios.request(config);
    console.log("cibilResponseData->", cibilResponse.data)

    return { cibilRequest: cibilRequestBody, cibilResponse: cibilResponse.data };
  }
  catch (error) {
    if (error.response) {
      console.log("CIBIL API Error:", error.response?.data?.message);
      handleSurepassResponse(error.response?.data);
    } else {
      console.log("CIBIL API Error:", error.message);
      throw new ResponseError(500, error.message || "Failed to connect to the third party API to get CIBIL details");
    }
  }
};  // SUREPASS CIBIL API
// };  // SUREPASS CIBIL API


export const sanctionAPI = async (base64_encoded, full_name, personal_email, mobile, lead_id) => {
  try {
    let data = JSON.stringify({
      consent: "Y",
      documentB64: base64_encoded,
      referenceNumber: "REF123456789",
      documentName: "Loan_Agreement.pdf",
      isSequence: false,
      templateId: "bottom-left",
      redirectionUrl: "http://localhost:8000/api/user/redirect-url",
      reviewerMail: "uvesh.ahmed@blinkrloan.com",
      signerInfo: [
        {
          name: full_name,
          email: personal_email,
          mobile: `+91${mobile}`,
        },
      ],
      clientData: {
        caseId: lead_id
      }
    });
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: process.env.SEND_FOR_ESIGN,
      headers: {
        "x-karza-key": process.env.KARZA_API_KEY,
        "Content-Type": "application/json",
      },
      data: data,
    };
    const response = await axios.request(config);
    return { apiRequest: config, apiResponse: response.data };

  } catch (error) {
    console.log("Sanction API Error : ", error)
    if (error.response) {
      throw new ResponseError(
        error.response.status || 500,
        error.response.data?.error || 'Third-Party API returned an error'
      );
    } else {
      throw new ResponseError(
        500,
        error.message || 'Failed to connect to the third party API to sanction loan'
      );
    }

  }

}; //PERFIOS API
// }; //PERFIOS API

// Disburse Loan API
export const disburseLoanAPI = async (data) => {
  try {
    const requestData = {
      account_number: data.account_number,
      ifsc: data.ifsc,
      amount: data.amount,
      customer_name: data.customer_name,
      loan_no: data.loan_no,
      pan: data.pan,
    };

    const response = {
      transaction_id: "GSUIQGDD9746D497D",
      payment_status: "SUCCESS",
      amount: data.amount,
    };
    return {
      apiRequest: requestData,
      apiResponse: response,
    };
  } catch (error) {
    console.error("Disburse Loan API Error:", error.message);
    return {
      apiRequest: null,
      apiResponse: {
        status: "error",
        message: error.message || "Failed to disburse loan",
      },
    };
  }
}; // ICICI API
// }; // ICICI API

export const fetchLocationAPI = async (lat, lng) => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new ResponseError(500, "Google Maps API key not configured");
    }

    let config = {
      method: "get",
      url: process.env.GOOGLE_MAP_URI,
      params: { latlng: `${lat},${lng}`, key: apiKey },
      headers: {
        "Content-Type": "application/json",
      },
    };

    const response = await axios.request(config);
    const { data } = response;

    if (data.status !== 'OK') {
      throw new ResponseError(400, data.error_message || 'Address not found');
    }

    const result = data.results[0];
    const pincodeComponent = result.address_components.find(c =>
      c.types.includes('postal_code')
    );

    return {
      locationRequest: config,
      locationResponse: {
        status: "success",
        address: result.formatted_address,
        pincode: pincodeComponent?.long_name || 'Not available',
        coordinates: result.geometry.location,
        state: result.address_components.find(c =>
          c.types.includes('administrative_area_level_1')
        )?.long_name || 'Not available',
        area: result.address_components.find(c =>
          c.types.includes('sublocality_level_1') || c.types.includes('locality')
        )?.long_name || 'Not available',
        city: result.address_components.find(c =>
          c.types.includes('political') && c.types.includes('administrative_area_level_3')
        )?.long_name || 'Not available'
      },
      completeResponse: data
    };

  } catch (error) {
    console.error("Fetch Location API Error:", error.message);

    if (error instanceof ResponseError) {
      throw error; // Re-throw known errors
    }

    // Wrap unexpected errors in a ResponseError
    throw new ResponseError(500, error.message || "Failed to connect to the third party API to fetch location details");
  };
}// GOOGLE MAPS API
// }// GOOGLE MAPS API

// surepass API aadhaar-kyc step - 1
export const sendAadhaarOtpAPISurePass = async (aadhaar) => {
  try {
    console.log("aadhaar----->KYC________", aadhaar)
    const response = await fetch(process.env.SEND_AADHAAR_OTP_SUREPASS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.SURE_PASS_ACCESS_TOKEN_PRODUCTION_PRODUCTION,
        'Authorization': process.env.SURE_PASS_ACCESS_TOKEN_PRODUCTION_PRODUCTION,
      },
      body: JSON.stringify({
        id_number: aadhaar
      })
    });

    const data = await response.json();
    console.log("response----->", data);
    return data;
  }
  catch (error) {
    if (error.response) {
      console.log("Submit Aadhaar OTP API Error : ", error.response?.data?.message)
      handleSurepassResponse(error.response.data)
    } else {
      console.log("Submit Aadhaar OTP API Error : ", error.message)
      throw new ResponseError(500, error.message || "Failed to connect to the third party API to submit Aadhaar OTP");
    }
  }
};

// surepass API aadhaar-kyc step - 2
export const validateAadhaarOtpAPIsurepass = async (otp, accessKey) => {

  try {
    let data = JSON.stringify({
      "client_id": accessKey,
      "otp": otp
    });

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: process.env.VALIDATE_ADDHAAR_OTP_SUREPASS,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.SURE_PASS_ACCESS_TOKEN_PRODUCTION_PRODUCTION,
        // 'Authorization': process.env.SURE_PASS_ACCESS_TOKEN_PRODUCTION_PRODUCTION,
      },
      data: data
    };

    const response = await axios.request(config)
    // console.log("response----->", response.data.status_code)
    return { aadhaarResponse: response.data, aadhaarRequest: config };
  }
  catch (error) {
    if (error.response) {
      console.log("Submit Aadhaar OTP API Error : ", error.response?.data?.message)
      handleSurepassResponse(error.response.data)
    } else {
      console.log("Submit Aadhaar OTP API Error : ", error.message)
      throw new ResponseError(500, error.message || "Failed to connect to the third party API to validate Aadhaar OTP");
    }
  }

}

// ! e-Sign API

// e-Sign Step 1
export const esignInitAPI = async (payload) => {
  try {
    const response = await fetch(process.env.ESIGN_INIT_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.SURE_PASS_ACCESS_TOKEN_PRODUCTION_PRODUCTION,
      },
      body: JSON.stringify(payload)
    });

    const apiResponse = await response.json();
    return {
      apiRequest: payload,
      apiResponse
    };
  } catch (error) {
    if (error.response) {
      console.log("e-Sign Init API Error:", error.response?.data?.message);
      handleSurepassResponse(error.response?.data);
    } else {
      console.log("e-Sign Init API Error:", error.message);
      throw new ResponseError(500, error.message || "Failed to connect to the third party API to initialize e-sign");
    }
  }
}; //SUREPASS API
// }; //SUREPASS API

// e-Sign step 2
export const getUploadUrlAPI = async (payload) => {
  try {
    const response = await fetch(process.env.ESIGN_GET_UPLOAD_URL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.SURE_PASS_ACCESS_TOKEN_PRODUCTION_PRODUCTION,
      },
      body: JSON.stringify(payload)
    });

    const apiResponse = await response.json();
    return {
      apiRequest: payload,
      apiResponse
    };
  } catch (error) {
    if (error.response) {
      console.log("Get Upload URL API Error:", error.response?.data?.message);
      handleSurepassResponse(error.response?.data);
    } else {
      console.log("Get Upload URL API Error:", error.message);
      throw new ResponseError(500, error.message || "Failed to connect to the third party API to get upload URL");
    }
  }
}; //SUREPASS API

export const getSingedDocUrl = async (document_id) => {
  try {
    const url = `${process.env.ESIGN_DOWNLOAD_FILE_SUREPASS}/${document_id}`;
    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: url,
      headers: {
        'Authorization': process.env.SURE_PASS_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
    };
    const response = await axios.request(config);
    return { apiRequest: config, apiResponse: response.data };
  } catch (error) {
    if (error.response) {
      console.log("Get Signed Doc URL API Error:", error.response?.data?.message);
      handleSurepassResponse(error.response?.data);
    } else {
      console.log("Get Signed Doc URL API Error:", error.message);
      throw new ResponseError(500, error.message || "Failed to connect to the third party API to get signed document URL");
    }

  }
};// PERFIOS API
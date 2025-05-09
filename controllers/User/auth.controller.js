import pkg from '@prisma/client';
const { PrismaClient, Gender } = pkg;


import {
  API_TYPE,
  Employee_Type,
  LEAD_STAGE,
  SOURCE,
  ADDRESS_SOURCE,
  COUNTRY,
  STATE_CODE_MAP,
} from "../../constants/constants.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import {
  sendOtpAPI,
  verifyOtpAPI,
  fetchPanDetailsAPI,
  fetchCibilAPI,
  sendEmailOtpAPI,
  verifyEmailOtpAPI,
  fetchLocationAPI,
  fetchOnGridAddress,
} from "../../service/thirdParty.js";
import { handleThirdPartyResponseCibil } from "../../utils/apiResponseCibil.js";
import { handleSurepassResponse, handleThirdPartyResponse } from "../../utils/apiResponse.js";
import { ResponseError } from "../../utils/responseError.js";
import { nextSequence } from "../../utils/nextSequence.js";
import getAge from "../../utils/calculateAge.js";
import { calculateLoanDetails } from "../../utils/loan.information.js";
import { calculateRepaymentDate } from "../../utils/calculateTenure.js";

dotenv.config();
import asyncHandler from "../../utils/asyncHandler.js";
import { dummyCIBIL } from '../../constants/dummyCIBIL.js';

const prisma = new PrismaClient();

// ------------------------------------------------------------------------------------------

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const oldPanRegex = /^[A-Z0-9]{10}$/;
const mobileRegex = /^[6-9]\d{9}$/;

export const sendOTP = asyncHandler(async (req, res) => {
  const { PAN: inputPAN, phone_number, lat, lng } = req.body;
  const PAN = inputPAN.toUpperCase();
  console.log(
    "-------------->>>>>>>PAN: inputPAN, phone_number, lat, lng ",
    PAN,
    phone_number,
    lat,
    lng
  );

  // Validate required fields
  if (!PAN || !phone_number) {
    throw new ResponseError(400, "PAN and phone number are required");
  }

  // Validate field formats
  if (!mobileRegex.test(phone_number)) {
    throw new ResponseError(400, "Invalid mobile number format");
  }

  if (!(panRegex.test(PAN) || oldPanRegex.test(PAN))) {
    throw new ResponseError(400, "Invalid PAN format");
  }

  // Check existing customer
  const customer = await prisma.customer.findUnique({
    where: { pan: PAN },
  });

  if (!customer) {
    // New customer validations
    if (!lat || !lng) {
      throw new ResponseError(400, "Coordinates required for new customers");
    }

    // Check blacklisted PAN
    const [blackListedPan, locationData] = await Promise.all([
      prisma.blacklisted_pan.findFirst({ where: { pan: PAN } }),
      fetchLocationAPI(lat, lng),
    ]);

    if (blackListedPan) {
      throw new ResponseError(400, "PAN is blacklisted");
    }

    // Validate serviceable pincode
    const pincode = locationData?.locationResponse?.pincode;
    if (!pincode) {
      throw new ResponseError(400, "Could not fetch pincode from coordinates");
    }

    const isServiceable = await prisma.serviceable_pin_code.findFirst({
      where: { pincode },
    });
    console.log("isServiceable---->", pincode, isServiceable)
    // if (!isServiceable) {
    //   throw new ResponseError(400, `Area ${pincode} not serviceable`);
    // }
  }

  // Send OTP
  const otpResponse = await sendOtpAPI(phone_number);
  console.log(otpResponse);
  if (otpResponse["status_code"] == 200) {
    console.log("if block ");
    return res.status(200).json({
      message: "OTP sent successfully",
      request_id: otpResponse.data?.client_id,
      PAN,
      phone_number,
    });
  } else {
    console.log("else block");
    handleSurepassResponse(otpResponse);
  }
});

export const verifyOTP = asyncHandler(async (req, res) => {
  const { PAN, otp, request_id, phone_number } = req.body;
  console.log("body-->", req.body);

  if (!otp || !request_id) {
    throw new ResponseError(400, "OTP or request_id is required");
  }

  const otpResponse = await verifyOtpAPI(otp, request_id);
  console.log("--->", otpResponse);
  if (otpResponse?.["status_code"] != "200") {
    console.log("error block-->");
    handleSurepassResponse(otpResponse);
  }

  // Common response handler
  const sendTokenResponse = (user, token) => {
    res.cookie("user_jwt", token, {
      expires: new Date(Date.now() + 8 * 3600000),
    });
    return res.status(200).json({
      message: user
        ? "User login successful!"
        : "User Registered Successfully!",
      token,
    });
  };

  await prisma.$transaction(
    async (prisma) => {
      const user = await prisma.customer.findUnique({ where: { pan: PAN } });

      if (user) {
        const token = jwt.sign({ id: user.id }, process.env.USER_JWT, {
          expiresIn: 30 * 24 * 60 * 60,
        });

        await prisma.customer.update({
          where: { id: user.id },
          data: { auth_token: token, last_logged_in: new Date() },
        });

        return sendTokenResponse(user, token);
      }

      // --------------- New User Scenario ---------------
      const { lat, lng } = req.body;
      if (!lat || !lng) {
        throw new ResponseError(400, "Latitude and Longitude are required");
      }

      const [locationResult, panResult] = await Promise.all([
        fetchLocationAPI(lat, lng),
        fetchPanDetailsAPI(PAN),
      ]);

      const { locationRequest, locationResponse, completeResponse } =
        locationResult;
      const { panResponse, panRequest } = panResult;

      if (panResponse?.status_code != "200") {
        handleSurepassResponse(panResponse);
      }
      console.log("------->>>>>", panResponse, panRequest);

      // Cache PAN details
      const panDetails = panResponse?.data || {};

      const age = getAge(panDetails.dob);
      if (age !== null && age < 18) {
        throw new ResponseError(400, "User must be at least 18 years old.");
      }
      if (!panDetails.aadhaar_linked) {
        throw new ResponseError(400, "PAN is not linked to Aadhaar");
      }

      // Create PAN log
      const panLog = await prisma.api_Logs.create({
        data: {
          pan: PAN,
          api_type: API_TYPE.PAN_DETAILS,
          api_provider: 2,
          api_request: panRequest || null,
          api_response: panResponse || null,
          // api_request: JSON.stringify(panRequest),
          // api_response: JSON.stringify(panResponse),
          api_status: true,
        },
      });
      let customer_no = await nextSequence(prisma, "customer_no", "CUSTNO", 10);
      // Common customer data
      const customerData = {
        customer_no,
        pan: PAN,
        last_logged_in: new Date(),
        is_logged_in: true,
        recent_credit_score_date: new Date(),
        f_name: panDetails?.full_name_split[0] || "",
        m_name: panDetails?.full_name_split[1] || "",
        l_name: panDetails?.full_name_split[2] || "",
        full_name: panDetails?.full_name || "",
        gender: panDetails?.gender
          ? panDetails?.gender.toUpperCase() === "M"
            ? Gender.M
            : panDetails?.gender.toUpperCase() === "F"
              ? Gender.F
              : Gender.O
          : null,
        dob: new Date(panDetails?.dob) || null,
        mobile: phone_number,
      };

      const customer = await prisma.customer.create({ data: customerData });

      // Common lead data
      const leadBaseData = {
        tenure: 30,
        mobile: phone_number,
        customer_id: customer.id,
        f_name: panDetails?.full_name_split[0] || "",
        m_name: panDetails?.full_name_split[1] || "",
        l_name: panDetails?.full_name_split[2] || "",
        full_name: panDetails?.full_name || "",
        gender: panDetails?.gender
          ? panDetails?.gender.toUpperCase() === "M"
            ? Gender.M
            : panDetails?.gender.toUpperCase() === "F"
              ? Gender.F
              : Gender.O
          : null,
        dob: new Date(panDetails?.dob) || null,
        lead_stage: LEAD_STAGE.COMPLETE_REGISTRATION,
        lat: String(locationResponse.coordinates.lat),
        lng: String(locationResponse.coordinates.lng),
        address: locationResponse.address,
        city: locationResponse.city,
        state: locationResponse.state,
        pincode: locationResponse.pincode,
        country: COUNTRY.INDIA,
        is_lead_verify_by_otp: true,
      };

      const existingLead = await prisma.lead.findFirst({
        where: {
          pan: PAN,
          source: SOURCE.MARKETING,
          lead_stage: LEAD_STAGE.PENDING_LEAD,
        },
      });

      let lead;
      if (existingLead) {
        lead = await prisma.lead.update({
          where: { id: existingLead.id },
          data: { ...leadBaseData, source: SOURCE.MARKETING },
        });
      } else {
        lead = await prisma.lead.create({
          data: {
            ...leadBaseData,
            lead_no: await nextSequence(prisma, "lead_no", "FUNDO", 10),
            pan: PAN,
            source: SOURCE.FUNDO_WEB,
          },
        });
      }

      const auth_token = jwt.sign({ id: customer.id }, process.env.USER_JWT, {
        expiresIn: 30 * 24 * 60 * 60,
      });

      await Promise.all([
        prisma.customer.update({
          where: { id: customer.id },
          data: { auth_token },
        }),
        prisma.api_Logs.update({
          where: { id: panLog.id },
          data: { lead_id: lead.id, customer_id: customer.id },
        }),
        prisma.customer_address.create({
          data: {
            customer_id: customer.id,
            lead_id: lead.id,
            pan: PAN,
            address_source: ADDRESS_SOURCE.GEO_LOCATION,
            address: locationResponse.address,
            city: locationResponse.city,
            state: locationResponse.state,
            pincode: locationResponse.pincode,
            country: COUNTRY.INDIA,
          },
        }),
        prisma.api_Logs.create({
          data: {
            pan: PAN,
            customer_id: customer.id,
            lead_id: lead.id,
            api_type: API_TYPE.LOCATION_DETAILS,
            api_provider: 1,
            api_request: locationRequest,
            api_response: completeResponse,
            api_status: true,
          },
        }),
        prisma.lead_Logs.createMany({
          data: [
            {
              customer_id: customer.id,
              lead_id: lead.id,
              pan: PAN,
              remarks: "Create New Lead",
            },
            {
              customer_id: customer.id,
              lead_id: lead.id,
              pan: PAN,
              remarks: "Verify Mobile",
            },
            {
              customer_id: customer.id,
              lead_id: lead.id,
              pan: PAN,
              remarks: "Fetch PAN Details",
            },
            {
              customer_id: customer.id,
              lead_id: lead.id,
              pan: PAN,
              remarks: "Fetch Address From Geo-Location",
            },
          ],
        }),
      ]);

      return sendTokenResponse(user, auth_token);
    },
    { timeout: 30000 }
  );
});

export const sendEmailOTP = asyncHandler(async (req, res) => {
  const { office_email, personal_email } = req.body;

  const office_email_regex =
    /^[a-zA-Z0-9._%+-]+@(?!gmail\.com$|yahoo\.com$|hotmail\.com$|outlook\.com$|live\.com$|aol\.com$)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const personal_email_regex =
    /^[a-zA-Z0-9._%+-]+@(gmail\.com|yahoo\.com|hotmail\.com|outlook\.com|live\.com|aol\.com)$/i;
  if (!office_email) {
    throw new ResponseError(400, "Please fill office_email");
  }
  if (!personal_email) {
    throw new ResponseError(400, "Please fill personal_email");
  }
  if (!office_email_regex.test(office_email)) {
    throw new ResponseError(400, "Invalid office email format");
  }
  if (!personal_email_regex.test(personal_email)) {
    throw new ResponseError(400, "Invalid personal email format");
  }
  const user_id = req.user.id;
  console.log(user_id, "console.log");
  const user = await prisma.customer.findUnique({
    where: { id: user_id },
  });

  const lead = await prisma.lead.findFirst({
    where: { customer_id: user.id },
    orderBy: { created_at: "desc" },
  });
  if (!lead) {
    throw new ResponseError(400, "Lead not found");
  }
  if (lead.is_rejected) {
    throw new ResponseError(400, "Your Lead is rejected");
  }

  if (!lead.is_employee_type_filled) {
    throw new ResponseError(400, "Please fill employee type first");
  }
  if (lead.is_personal_email_verify || lead.is_office_email_verify) {
    throw new ResponseError(400, "Email already verified");
  }
  // const { otpResponse, otpRequest } = await validateEmailAPI(personal_email);
  // if (otpResponse?.statusCode != "101") {
  //   handleThirdPartyResponse(otpResponse);
  // }
  // if (otpResponse.result[0].emailAndDomainValidationDetails.emailExists === "No") {
  //   throw new ResponseError(400, "Please enter valid email your email does not Exists")
  // }

  const sendOtpResponse = await sendEmailOtpAPI(office_email, user.full_name);

  if (sendOtpResponse?.statusCode != "101") {
    handleThirdPartyResponse(sendOtpResponse);
  }
  await prisma.$transaction(
    async (prisma) => {
      // update lead_stage
      const leadDetails = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          lead_stage: LEAD_STAGE.SEND_EMAIL_OTP,
        },
      });

      // await prisma.lead_Logs.create({
      //   data: {
      //     customer_id: user.id,
      //     lead_id: lead.id,
      //     pan: user.pan,
      //     remarks: "Send OTP for Email Verification",
      //   },
      // });
      await prisma.lead_Logs.create({
        data: {
          customer_id: user.id,
          lead_id: lead.id,
          pan: user.pan,
          remarks: "Personal Email add and Office Email Verified Sucessfully",
        },
      });
      let current_stage;
      current_stage = leadDetails ? leadDetails.lead_stage : null;

      return res.status(200).json({
        message: sendOtpResponse?.result?.message || "OTP sent successfully",
        request_id: sendOtpResponse.requestId,
        office_email,
        personal_email,
        current_stage,
      });
    },
    { timeout: 30000 }
  );
});

export const verifyEmailOTP = asyncHandler(async (req, res) => {
  const { otp, request_id, office_email, personal_email } = req.body;
  console.log("req.body-->", req.body);

  if (!otp || !request_id) {
    throw new ResponseError(400, "OTP is required");
  }
  if (!office_email || !personal_email) {
    throw new ResponseError(400, "Please fill required details");
  }

  const otpResponse = await verifyEmailOtpAPI(otp, request_id);

  if (otpResponse?.statusCode != "101") {
    handleThirdPartyResponse(otpResponse);
  }
  const user_id = req.user.id;
  await prisma.$transaction(
    async (prisma) => {
      const user = await prisma.customer.findUnique({
        where: { id: user_id },
      });

      const lead = await prisma.lead.findFirst({
        where: { customer_id: user.id },
        orderBy: { created_at: "desc" },
      });
      if (lead.is_rejected) {
        throw new ResponseError(400, "Your Lead is rejected");
      }
      const leadDetails = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          is_office_email_verify: true,
          is_personal_email_verify: true,
          lead_stage: LEAD_STAGE.VRIFY_EMAIL_OTP,
          office_email: office_email,
          personal_email: personal_email,
        },
      });

      await prisma.customer.update({
        where: { id: user.id },
        data: { office_email, personal_email },
      });

      await prisma.lead_Logs.create({
        data: {
          customer_id: user.id,
          lead_id: lead.id,
          pan: user.pan,
          remarks: "Personal Email add and Office Email Verified Sucessfully",
        },
      });
      let current_stage;
      current_stage = leadDetails ? leadDetails.lead_stage : null;

      return res
        .status(200)
        .json({ message: "Email verified successfully", current_stage });
    },
    { timeout: 30000 }
  );
});


export const addEmployement = asyncHandler(async (req, res) => {
  console.log("/user/add-employement", req.body);
  const { employee_type, company_name, salary_date, net_salary } = req.body;
  const userId = req.user.id;
  // console.log("req.body---->>>",req.body)
  await prisma.$transaction(
    async (prisma) => {
      // Fetch latest lead once and reuse
      const lead = await prisma.lead.findFirst({
        where: { customer_id: userId },
        orderBy: { created_at: "desc" },
      });

      // Early validation checks
      if (lead.is_rejected)
        throw new ResponseError(400, "Your Lead is rejected");
      if (lead.is_employee_type_filled)
        throw new ResponseError(400, "Employee type already filled");

      // Handle self-employed case first
      if (employee_type === Employee_Type.SELF_EMPLOYED) {
        const [updatedLead] = await Promise.all([
          prisma.lead.update({
            where: { id: lead.id },
            data: {
              lead_stage: LEAD_STAGE.PENDING_EMPLOYEMENT,
              is_person_salaried: false,
              is_employee_type_filled: true,
              is_rejected: true,
              rejection_remarks: "Customer is SELF_EMPLOYED",
              rejected_by: 999,
            },
          }),
          prisma.customer.update({
            where: { id: userId },
            data: { employement_type: Employee_Type.SELF_EMPLOYED },
          }),
          prisma.lead_Logs.create({
            data: {
              customer_id: userId,
              lead_id: lead.id,
              pan: lead.pan,
              remarks: "ADD_EMPLOYEMENT with SELF_EMPLOYED",
            },
          }),
        ]);

        return res.status(301).json({
          message: "Our team will reach you very soon",
          current_stage: updatedLead.lead_stage,
        });
      }

      // Parallelize customer data fetching
      const [cust, cust_address] = await Promise.all([
        prisma.customer.findUnique({ where: { id: userId } }),
        prisma.customer_address.findFirst({
          where: {
            lead_id: lead.id,
            address_source: ADDRESS_SOURCE.GEO_LOCATION,
          },
        }),
      ]);

      if (!cust) throw new ResponseError(400, "Customer not found");
      if (!cust_address)
        throw new ResponseError(400, "Customer address not found");

      // Date formatting utilities
      const formatDateComponent = (value) => String(value).padStart(2, "0");
      const dob = cust.dob;
      const birthDate = [
        formatDateComponent(dob.getDate()),
        formatDateComponent(dob.getMonth() + 1),
        dob.getFullYear(),
      ].join("");

      // CIBIL request preparation
      const fullName = [cust.f_name, cust.m_name, cust.l_name].filter(Boolean).join(" ");

      const cibilRequestBody = {
        name: fullName,
        gender: cust.gender?.toLowerCase() === "m" ? "male" : "female",
        pan: cust.pan,
        mobile: cust.mobile,
      };

      console.log("cibilRequestBody---->>>", cibilRequestBody)
      // CIBIL API handling
      const { cibilResponse, cibilRequest } = await fetchCibilAPI(
        cibilRequestBody
      );
      if (cibilResponse?.status_code != "200") {
        handleSurepassResponse(cibilResponse);
        console.log("cibilResponse---->>>", cibilResponse);
      }
      // const cibilResponse = dummyCIBIL;
      console.log("cibilResponse---->>>", cibilResponse?.data?.credit_score);
      console.log("cibilResponse---->>> type", typeof (cibilResponse?.data?.credit_score));

      // Batch database operations
      const [apiLog, leadLog, updatedLead] = await Promise.all([
        prisma.api_Logs.create({
          data: {
            pan: lead.pan,
            api_type: API_TYPE.CREDIT_REPORT,
            api_provider: 1,
            // api_request: cibilRequest,   FOR REAL CIBIL API call
            api_request: cibilRequestBody,    //FOR DUMMY CIBIL API call
            api_response: cibilResponse,
            api_status: true,
            lead_id: lead.id,
            customer_id: userId,
          },
        }),
        prisma.lead_Logs.create({
          data: {
            customer_id: userId,
            lead_id: lead.id,
            pan: lead.pan,
            remarks: "Fetch CIBIL",
          },
        }),
        prisma.lead.update({
          where: { id: lead.id },
          data: {
            lead_stage: LEAD_STAGE.ADD_EMPLOYEMENT,
            credit_score: Number(cibilResponse?.data?.credit_score),
            is_person_salaried: true,
            is_employee_type_filled: true,
            elegible_loan_amount: 7000,     //TODO: change this value based on credit score
            salary_date: new Date(salary_date),
          },
        }),
        prisma.customer.update({
          where: { id: userId },
          data: {
            credit_score: Number(cibilResponse?.data?.credit_score),
            employement_type: employee_type,
            company_name,
            salary_date: new Date(salary_date),
            net_monthly_salary: parseInt(net_salary),
          },
        }),
      ]);

      await prisma.lead_Logs.create({
        data: {
          customer_id: userId,
          lead_id: lead.id,
          pan: lead.pan,
          remarks: "Employement added successfully",
        },
      });

      return res.status(200).json({
        credit_score: cibilResponse?.data?.credit_score,
        message: "Employement added successfully",
        current_stage: updatedLead.lead_stage,
        elegible_loan_amount: updatedLead.elegible_loan_amount,
        cibil_name: cibilResponse?.data?.name,     // TODO: remove this field from response
      });
    },
    { timeout: 30000 }
  );
});

export const requestLoan = asyncHandler(async (req, res) => {
  const { loan_amount } = req.body;
  const userId = req.user.id;

  // Cache repeated values
  const user = await prisma.customer.findUnique({ where: { id: userId } });
  const lead = await prisma.lead.findFirst({
    where: { customer_id: userId },
    orderBy: { created_at: "desc" },
  });

  if (!lead) throw new ResponseError(400, "Lead not found for this customer.");

  // Early validation checks
  const validations = [
    { check: lead.is_rejected, message: "Your Lead is rejected" },
    {
      check: !lead.is_bre_complete,
      message: "BRE is not complete for the lead.",
    },
    {
      check: !lead.is_bsa_complete,
      message: "BSA is not complete for the lead.",
    },
    {
      check: loan_amount > lead.elegible_loan_amount,
      message:
        "Loan amount should not be greater than max eligible loan amount.",
    },
  ];

  for (const validation of validations) {
    if (validation.check) throw new ResponseError(400, validation.message);
  }

  // const { onGridRequest, onGridResponse } = await fetchOnGridAddress(
  //   lead.mobile
  // );
  // const addressDataArray = onGridResponse?.data?.address_data || [];

  await prisma.$transaction(
    async (prisma) => {
      // Cache frequently used values
      const leadId = lead.id;
      const pan = user.pan;

      // Calculate once and reuse
      const { repaymentDate, tenure } = calculateRepaymentDate(
        lead.salary_date
      );
      const loanDetails = calculateLoanDetails(loan_amount, tenure, 10); // 10% intrest rate 

      // Sanction data preparation
      const sanctionData = {
        sanction_date: new Date(),
        loan_amount,
        repayment_date: new Date(repaymentDate),
        repayment_amount: loanDetails.repaymentAmount,
        processing_fee: loanDetails.pfAmount,
        roi: 1,
        pf_percent: loanDetails.pfPercent,
        pf_amount: loanDetails.pfAmount,
        insurance: loanDetails.insurance,
        total_admin_fee: loanDetails.totalAdminFees,
        net_admin_fee: loanDetails.netAdminFee,
        net_disbursal: loanDetails.netDisbursal,
        interest_amount: loanDetails.interestAmount,
        gst: loanDetails.gst,
        apr: loanDetails.apr,
        tenure: Number(tenure),
      };

      // Update or create sanction
      const existingSanction = await prisma.sanction.findFirst({
        where: { lead_id: leadId },
      });

      let loan_no 
      if (existingSanction) {
        await prisma.sanction.update({
          where: { id: existingSanction.id },
          data: sanctionData,
        });
      } else {
          loan_no = await nextSequence(prisma, "loan_no", "FUNDOLOAN", 10);
        await prisma.sanction.create({
          data: {
            ...sanctionData,
            pan,
            lead_id: leadId,
            lead_no: lead.lead_no,
            loan_no,
            approved_by: 999,
          },
        });
      }

      // Address processing
      // const addressOperations = [];

      // if (addressDataArray.length === 0) {
      //   addressOperations.push(
      //     prisma.lead_Logs.create({
      //       data: {
      //         customer_id: userId,
      //         lead_id: leadId,
      //         pan,
      //         remarks: `For mobile no: ${user.mobile} grid API didn't fetch any address`,
      //       },
      //     })
      //   );
      // } else {
      //   // Batch address creation
      //   addressOperations.push(
      //     prisma.customer_address.createMany({
      //       data: addressDataArray.map((addressData) => ({
      //         customer_id: userId,
      //         lead_id: leadId,
      //         pan,
      //         address_source: ADDRESS_SOURCE.ON_GRID,
      //         address: `${addressData.line1}, ${addressData.line2}`,
      //         state: addressData?.state || "",
      //         country: addressData?.country || "",
      //         pincode: addressData?.pincode || "",
      //         city: addressData?.city || "",
      //       })),
      //     }),
      //     prisma.lead_Logs.create({
      //       data: {
      //         customer_id: userId,
      //         lead_id: leadId,
      //         pan,
      //         remarks: "Pull address from on grid API successfully!",
      //       },
      //     })
      //   );
      // }

      // Lead update and final logging
      const [updatedLead] = await Promise.all([
        prisma.lead.update({
          where: { id: leadId },
          data: {
            is_loan_requested: true,
            lead_stage: LEAD_STAGE.LOAN_REQUESTED,
            loan_amount,
            tenure,
            loan_no
          },
        }),
        // ...addressOperations,
      ]);

      await prisma.lead_Logs.create({
        data: {
          customer_id: userId,
          lead_id: leadId,
          pan,
          remarks: `Loan requested successfully with amount ${loan_amount}, tenure ${tenure} with repayment date ${repaymentDate}`,
        },
      });

      return res.status(200).json({
        message: "Loan requested successfully!",
        current_stage: updatedLead.lead_stage,
        loan_amount,
      });
    },
    { timeout: 30000 }
  );
});

export const getJourney = asyncHandler(async (req, res) => {
  const user = await prisma.customer.findUnique({
    where: { id: req.user.id },
  });

  // find latest lead
  const lead = await prisma.lead.findFirst({
    where: { customer_id: user.id },
    orderBy: { created_at: "desc" },
  });
  // console.log("____________lead", lead);
  const journey = {
    // step - 1
    is_kyc_approved: lead?.is_kyc_approved,
    is_kyc_reject: lead?.is_kyc_reject,
    is_personal_email_verify: lead?.is_personal_email_verify,
    is_office_email_verify: lead?.is_office_email_verify,
    is_employee_type_filled: lead?.is_employee_type_filled,
    is_loan_requested: lead?.is_loan_requested,

    is_bre_complete: lead?.is_bre_complete,
    is_bsa_complete: lead?.is_bsa_complete,
    is_bre_reject: lead?.is_bre_reject,
    is_sanction: lead?.is_sanction,
    is_disbursed: lead?.is_disbursed,
    is_rejected: lead?.is_rejected,
    is_closed: lead?.is_closed,
    lead_stage: lead?.lead_stage,
  };

  return res.status(200).json({ journey });
});

export const logout = asyncHandler(async (req, res) => {
  await prisma.customer.update({
    where: { id: req.user.id },
    data: { is_logged_in: false, last_logged_in: new Date() },
  });
  res.clearCookie("user_jwt");
  return res.status(200).json({ message: "Logout successful" });
});

export const getUserProfile = asyncHandler(async (req, res) => {
  const user = await prisma.customer.findUnique({
    where: { id: req.user.id },
    select: {
      full_name: true,
    },
  });

  return res.status(200).json({
    message: "profile details get sucessfully",
    full_name: user.full_name,
  });
});

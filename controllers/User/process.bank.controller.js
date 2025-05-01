//bsa
import { Prisma, PrismaClient } from "@prisma/client";
import { ResponseError } from "../../utils/responseError.js";
import fetch from "node-fetch";
import asyncHandler from "../../utils/asyncHandler.js";
import { API_PATHS } from "../../constants/urlConstants.js";
// import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

// pdfjs.GlobalWorkerOptions.workerPort = null;

const prisma = new PrismaClient();

const processBsaCartApiInitiate = async (payload) => {
  try {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("auth-token", process.env.NOVAL_PATTERN_AUTH_KEY);

    const raw = JSON.stringify(payload);

    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };
    const response = await fetch(API_PATHS.PROCESS_BANK_STMT, requestOptions);
    const result = await response.json();
    console.log("________________", result);
    if (result.status == "Pending") {
      return result;
    }
    return false;
  } catch (error) {
    console.error("Send OTP API Error:", error);
    if (error.response) {
      throw new ResponseError(
        error.response.status || 500,
        error.response.data?.error || "Third-Party API returned an error"
      );
    } else {
      throw new ResponseError(
        500,
        error.message || "Failed to connect to Third-Party API"
      );
    }
  }
};

const asyncLeadLogs = async (userId, leadId, pan, remarks) => {
  await prisma.lead_Logs.create({
    data: {
      customer_id: userId,
      lead_id: leadId,
      pan: pan,
      remarks: remarks,
    },
  });
};

const processBankStatement = asyncHandler(async (req, res) => {
  try {
    const user = req.user;
    const { type, userBankName } = req?.body;

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    const userId = user.id;
    const userDetails = await prisma.customer.findUnique({
      where: {
        id: userId,
      },
    });
    if (!userDetails) {
      return res.status(404).json({ message: "UserDetails not found" });
    }
    const { pan, dob } = userDetails;
    if (!pan || !dob) {
      return res
        .status(400)
        .json({ message: "PAN or DOB is missing in user details" });
    }
    const lead = await prisma.lead.findFirst({
      where: {
        customer_id: userId,
      },
      orderBy: {
        created_at: "desc",
      },
    });
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }
    if (type != "AA" && type != "NB") {
      return res.status(401).json({ message: "type should be AA OR NB" });
    }

    const BANK_VALUE = {
      AA: "AA",
      NB: userBankName,
    };

    let payload = {
      fileNo: pan,
      name: user?.f_name,
      accountType: "Saving",
      bank: BANK_VALUE[type],
      contactNo: user?.mobile,
      defaultScreen: type === "NB" ? "NetBanking" : "",
      organizationName: user?.company_name,
      clientAuthKey: req.headers.authorization,
    };

    const bsaProcessResponse = await processBsaCartApiInitiate(payload);

    if (bsaProcessResponse.status === "Rejected") {
      return res.status(400).json({
        message: `Wrong file upload : ${bsaProcessResponse.message}`,
        isFraud: false,
        isSuccess: true,
        remarks: "Bank Upload 3rd party api, respo",
      });
    }

    // await asyncLeadLogs(
    //   userId,
    //   leadId,
    //   pan,
    //   `User Initiated BSA With ${type} :`
    // );

    console.log("Link Generated correct");
    // await asyncLeadLogs(userId, leadId, pan, "BSA + BRE ran successfully");

    return res.status(200).json({
      isSuccess: true,
      data: bsaProcessResponse,
    });
  } catch (error) {
    if (error.response) {
      throw new ResponseError(
        error.response.status || 500,
        error.response.data?.error || "Third-Party API returned an error"
      );
    } else {
      throw new ResponseError(
        500,
        error.message || "Failed to connect to Third-Party API"
      );
    }
  }
});

export { processBankStatement };

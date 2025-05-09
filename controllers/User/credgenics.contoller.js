import { PrismaClient } from "@prisma/client";
//import { fetchUploadDataCredgenicsApi } from "../../utils/credgenicsApi.js";


const prisma = new PrismaClient();

export const sendDataToCredgenics = async (loan_no) => {

    const [collection, disbursal, sanction, lead] = await Promise.all([
        prisma.collection.findFirst({
            where: {
                loan_no: loan_no
            }
        }),
        prisma.disbursal.findFirst({
            where: {
                loan_no: loan_no
            }
        }),
        prisma.sanction.findFirst({
            where: {
                loan_no: loan_no
            }
        }),
        prisma.lead.findFirst({
            where: {
                loan_no: loan_no
            }
        })
    ])

    if (!collection || !disbursal || !sanction || !lead) {
        return res.status(404).json({
            success: false,
            message: "Proper data not found for sending Credgenics"

        })
    }

    const data = {
        loan_no: loan_no,
        collection: collection,
        disbursal: disbursal,
        sanction: sanction,
        lead: lead
    }

    const payload = {
        loan_id: data?.loan_no,
        client_customer_id: data?.lead?.customer_id,
        loan_type: "Personal Loan",
        applicant_name: data?.lead?.full_name,
        applicant_email_details: [
            {
                applicant_email: data?.lead?.personal_email,
                applicant_email_type: "PERSONAL"
            },
            {
                email: data?.lead?.office_email,
                email_type: "OFFICE"
            }
        ],
        applicant_gender: data?.lead?.gender,
        applicant_contact_details: [
            {
                applicant_contact_number: data?.lead?.mobile,
                applicant_contact_number_type: "PERSONAL",

            }
        ],
        "applicant_monthly_income": 40000,
        "applicant_cibil_score": lead?.credit_score,
        "applicant_occupation": "Job",
        "applicant_aadhar_number": data.lead.aadhaar,
        "applicant_language": "hi",
        "applicant_pan_number": data.lead.pan,
        "total_loan_amount": data.sanction.loan_amount,
        "loan_tenure": data.sanction.tenure,
        "client_loan_sanction_date": data.sanction.sanction_date,
        "loan_end_date": data.sanction.repayment_date,
        "interest_on_loan": "",
        "tenure_finished": false,
        "security_type": "",
        "backed_by_surety": false,
        "loan_nbfc_name": "DEVASHISH CAPITAL  PVT. LTD.",
        "loan_nbfc_cin": "",
        "emi_amount": data.sanction.repayment_amount,
        "product_type": "",
        "credit_account_number": "",
        "credit_account_holder_name": data.lead.full_name,
        "credit_bank_name": "HDFC ",
        "credit_account_holder_type": "",
        "credit_bank_ifsc_code": "",
        "tags": "tag1,tag2",
        "agent_email": "",
        // "document_details": [
        //     {
        //         "security_mode": "NACH",
        //         "document_number": "757493",
        //         "document_bank_name": "HDFC Bank",
        //         "document_bank_ifsc_code": "",
        //         "document_amount": 50000,
        //         "document_date": "2018-04-10",
        //         "document_dishonour_date": "2018-04-12",
        //         "document_signature_name": "",
        //         "document_bounce_bank_account_number": "",
        //         "document_bounce_bank_ifsc_code": "",
        //         "document_bounce_charges": 100,
        //         "document_bounce_bank_name": "Yes Bank",
        //         "document_bounce_bank_address": "",
        //         "document_bounce_memo_date": "2018-04-12",
        //         "reason_of_document_bounce": "",
        //         "document_bounce_memo_reference_number": "",
        //         "document_sequence_number": "",
        //         "document_bounce_memo_return_date": "2019-06-23"
        //     }
        // ],
    }


    await prisma.api_Logs.create({
        data: {
            pan: lead.pan,
            api_type: "CREDGENICS",
            api_provider: 1,
            api_request: {},
            api_response: payload,
            api_status: true,
            customer_id: lead.customer_id,
            lead_id: lead.id,
        }
    })
    // const response = await fetchUploadDataCredgenicsApi(payload);


}


// export const getLoanDetails = async (loanNo) => {
//     try {
//         const loanDetails = await prisma.lead.findUnique({
//             where: { loan_no: loanNo },
//             include: {
//                 customer: true,
//                 sanction: true,
//                 disbursal: true,
//                 collection: true,
//                 documents: true,
//                 bank_details: true,
//                 transaction_history: true
//             }
//         })

//         if (!loanDetails) {
//             throw new ResponseError(404, 'Loan not found')
//         }

//         // Map database fields to required response format
//         const formattedResponse = {
//             loan_id: loanDetails.loan_no,
//             loan_type: "Personal Loan", // Add this field to your Lead model if needed
//             applicant_name: loanDetails.customer?.full_name || '',
//             applicant_dob: loanDetails.customer?.dob?.toISOString().split('T')[0] || '',
//             applicant_email_details: [
//                 {
//                     applicant_email: loanDetails.personal_email,
//                     applicant_email_type: "Personal"
//                 },
//                 {
//                     applicant_email: loanDetails.office_email,
//                     applicant_email_type: "Office"
//                 }
//             ].filter(e => e.applicant_email),
//             applicant_gender: mapGender(loanDetails.customer?.gender),
//             applicant_contact_details: [
//                 {
//                     applicant_contact_number: loanDetails.mobile,
//                     applicant_contact_number_type: "Personal"
//                 }
//             ],
//             applicant_monthly_income: loanDetails.customer?.monthly_income?.toNumber() || 0,
//             applicant_cibil_score: loanDetails.credit_score || 0,
//             applicant_occupation: loanDetails.customer?.employement_type || '',
//             applicant_aadhar_number: loanDetails.aadhaar || '',
//             applicant_pan_number: loanDetails.pan || '',
//             total_loan_amount: loanDetails.sanction?.loan_amount?.toNumber() || 0,
//             loan_tenure: loanDetails.sanction?.tenure?.toNumber() || 0,
//             client_loan_sanction_date: loanDetails.sanction?.sanction_date?.toISOString().split('T')[0] || '',
//             loan_end_date: calculateEndDate(loanDetails.sanction?.sanction_date, loanDetails.sanction?.tenure),
//             interest_on_loan: loanDetails.sanction?.roi?.toNumber() || 0,
//             emi_amount: calculateEMI(
//                 loanDetails.sanction?.loan_amount,
//                 loanDetails.sanction?.roi,
//                 loanDetails.sanction?.tenure
//             ),
//             credit_account_number: loanDetails.bank_details?.bank_acc_no || '',
//             credit_bank_name: loanDetails.bank_details?.bank_name || '',
//             credit_bank_ifsc_code: loanDetails.bank_details?.ifsc_code || '',
//             document_details: loanDetails.documents.map(doc => ({
//                 document_number: doc.id.toString(),
//                 document_bank_name: loanDetails.bank_details?.bank_name,
//                 document_date: doc.created_at.toISOString().split('T')[0],
//                 document_type: doc.document_type
//             })),
//             applicant_address: [{
//                 applicant_address_type: "Home",
//                 applicant_address_text: loanDetails.address || '',
//                 applicant_state: loanDetails.state || '',
//                 applicant_city: loanDetails.city || '',
//                 applicant_pincode: loanDetails.pincode ? parseInt(loanDetails.pincode) : 0
//             }],
//             defaults: loanDetails.collection.map(c => ({
//                 total_claim_amount: c.received_amount?.toNumber() || 0,
//                 date_of_default: c.date_of_recived?.toISOString().split('T')[0] || '',
//                 settlement_amount: c.sattelment?.toNumber() || 0
//             }))
//         }

//         return formattedResponse

//     } catch (error) {
//         throw new ResponseError(
//             error.status || 500,
//             error.message || 'Error fetching loan details'
//         )
//     }
// }

// // Helper functions
// const mapGender = (gender) => {
//     const genderMap = { M: 'Male', F: 'Female', O: 'Other' }
//     return genderMap[gender] || 'Other'
// }

// const calculateEndDate = (startDate, tenureMonths) => {
//     if (!startDate || !tenureMonths) return ''
//     const endDate = new Date(startDate)
//     endDate.setMonth(endDate.getMonth() + tenureMonths)
//     return endDate.toISOString().split('T')[0]
// }

// const calculateEMI = (principal, roi, tenure) => {
//     if (!principal || !roi || !tenure) return 0
//     const monthlyRate = roi / 1200
//     return principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -tenure))
// }
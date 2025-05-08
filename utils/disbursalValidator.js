import Joi from "joi";

const disbursalSchema = Joi.object({
    loan_no: Joi.string().trim().required().label("Loan Number"),

    payable_account: Joi.string()
        .trim()
        .pattern(/^\d{9,20}$/)
        .required()
        .label("Payable Account"),

    payment_mode: Joi.string()
        .valid("NEFT", "RTGS", "IMPS", "UPI", "CASH", "CHEQUE", "OTHER")
        .required()
        .label("Payment Mode"),

    amount: Joi.number()
        .positive()
        .precision(2)
        .required()
        .label("Amount"),

    remarks: Joi.string().max(500).allow("", null).label("Remarks"),

    utr: Joi.string()
        .trim()
        .pattern(/^[a-zA-Z0-9]{6,20}$/)
        .required()
        .label("UTR"),

    channel: Joi.string()
        .valid("BANK", "NBFC", "WALLET", "OTHER")
        .required()
        .label("Channel"),

    disbursal_date: Joi.date().iso().required().label("Disbursal Date"),

    bank_name: Joi.string().trim().min(2).max(100).required().label("Bank Name"),

    ifsc: Joi.string()
        .trim()
        .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
        .required()
        .label("IFSC Code"),
});

export const validateDisbursal = (data) => {
    const options = { abortEarly: false };
    return disbursalSchema.validate(data, options);
};

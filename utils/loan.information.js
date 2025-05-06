
function getInsurancePremium(loanAmount) {
  const slabs = [
    { insured: 25000, premium: 75 },
    { insured: 30000, premium: 90 },
    { insured: 35000, premium: 104 },
    { insured: 40000, premium: 120 },
    { insured: 45000, premium: 135 },
    { insured: 50000, premium: 150 }
  ];

  // Find nearest slab (equal or next higher)
  for (let i = 0; i < slabs.length; i++) {
    if (loanAmount <= slabs[i].insured) {
      return slabs[i].premium;
    }
  }

  // If higher than max slab, use the highest
  return slabs[slabs.length - 1].premium;
}

export const calculateLoanDetails = (loanAmount, tenureDays, pfPercent) => {
  const insurance = 0 // now static
  const dailyInterestRate = 0.01; // 1% per day

  const pfAmount = Math.round((loanAmount * pfPercent) / 100);
  const gst = Math.round(pfAmount * 0.18);
  const totalAdminFees = Math.round(pfAmount + insurance + gst);
  const netDisbursal = Math.round(loanAmount - totalAdminFees);
  const interestAmount = Math.round(loanAmount * dailyInterestRate * tenureDays);
  const repaymentAmount = Math.round(loanAmount + interestAmount);
  const netAdminFee = Math.round((totalAdminFees / 118) * 100);
  const apr = Number(
    (((totalAdminFees + interestAmount) / loanAmount) * (365 / tenureDays) * 100).toFixed(2)
  );

  return {
    loanAmount,
    tenureDays,
    pfPercent, // 
    pfAmount,
    insurance,
    totalAdminFees,
    netDisbursal,
    interestAmount,
    repaymentAmount,
    netAdminFee,
    gst,
    apr
  };
}



// console.log(calculateLoanDetails(5001, 19, 15))

// create sanction 
/*

((PF+Interest+Insurance Charges)/Loan Amount)*(365/total tenure)*100

          Net disbursed amount = Loan amount - total Admin fees
          Admin fees = Loan amount * percentage of Pf/100
          Repayment amount = Loan amount + Interest amount
          Interest amount = Loan amount * tenure in days * per day interest percent
          Formulae of net admin fees = (Total admin fees / 118)*100
          Gst = (Total admin fees/118)*18
--------------------------------------------------------------------

          Sanctioned Amount :	5001
          PF	15% : 750/-
          Insurance:  75/-
          Total PF	: 825/-
          Net Disbursal : 4175/-
          Repayment date	30/04/25
          Tenure	19 days
          ROI / 0.90%
          Interest: 855/-
          Total Repayment	5856/-

          APR : 645% 

          This is good to go

          -----------------------------------------------------------------------
          Sanctioned Amount :	5001
          PF	15% : 750/-
          Insurance:  75/-
          Total PF	: 825/-
          Net Disbursal : 4175/-
          Repayment date	30/04/25
          Tenure	19 days
          ROI / 0.90%
          Interest: 855/-
          Total Repayment	5856/-

          APR : 645%

          -------------------------------------------------------------------------




*/

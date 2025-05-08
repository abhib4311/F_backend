const generateLoanHTML = (sanction_detail, user_detail, headerImageBase64, footerImageBase64) => {

  const {
    loan_no,
    loan_amount,
    roi,
    interest_amount,
    pf_amount,
    total_admin_fee,
    net_disbursal,
    repayment_amount,
    repayment_date,
    tenure,
    apr,
    gst
  } = sanction_detail;
  // const { full_name } = { full_name: "abhishek" };
  const { full_name } = user_detail;


  const date = new Date(repayment_date);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const formattedRepaymentDate = `${day}/${month}/${year}`;
  return `
  <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      @page {
        size: A4;
        margin: 0mm;
      }
      body {
        font-family: Arial, sans-serif;
        line-height: 1.5;
        width: 210mm;
        height: 297mm;
        margin: 0 auto;
        padding: 0;
      }
      div {
        page-break-inside: avoid;
      }
      h1 {
        text-align: center;
        font-size: 24px;
        margin-bottom: 10px;
      }
      .kfs {
        width: 100%;
        border-collapse: collapse;
        margin: auto;
      }
      .kfs,
      .kfs-th,
      .kfs-td {
        border: 1px solid #000;
        padding: 3.65px;
      }
      .kfs-th,
      .kfs-td {
        text-align: left;
      }
      .details {
        margin-bottom: 20px;
      }
      .signature {
        margin-top: 20px;
        text-align: left;
      }
      #data {
        width: 50%;
      }
      .header-img {
        width: 100%;
        max-width: 100%;
        height: auto;
        display: block;
        margin-bottom: 10px;
      }
      .footer-img {
        width: 100%;
        max-width: 100%;
        height: auto;
        display: block;
        margin-top: 10px;
      }
      .content-wrapper {
        font-family: Arial, Helvetica, sans-serif;
        line-height: 25px;
        font-size: 14px;
        border: solid 1px #ddd;
        padding: 0 15px 0 15px;
        width: 95%;
        max-width: 210mm;
        box-sizing: border-box;
        margin: auto;
      }
      .header-wrapper {
        width: 95%;
        max-width: 210mm;
        margin: auto;
        padding: 0;
        page-break-after: avoid;
      }
      .footer-wrapper {
        width: 95%;
        max-width: 210mm;
        margin: auto;
        padding: 0;
        page-break-before: avoid;
      }
      .kfs-table {
        border: 1px solid #000;
        width: 95%;
        border-collapse: collapse;
        margin: 15px auto;
        font-size: 12px;
      }
      @media print {
        body {
          width: 210mm;
          height: 297mm;
        }
        .content-wrapper {
          width: 95%;
          border: none;
        }
        .header-wrapper {
          position: relative;
          margin-bottom: 0;
        }
        .content-wrapper {
          margin-top: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="header-wrapper">
      <img src="${headerImageBase64}" alt="Header" class="header-img" />
    </div>
    <div class="content-wrapper">
      <table class="kfs-table">
        <tr>
          <th colspan="12" style="text-align: center" class="kfs-th">
            <strong>Key Fact Statement (KFS)</strong>
          </th>
        </tr>
        <tr>
          <th class="kfs-th">S.No.</th>
          <th class="kfs-th">Parameters</th>
          <th class="kfs-th">Details</th>
        </tr>
        <tr>
          <td class="kfs-td">(a)</td>
          <td class="kfs-td" id="data">Loan ID</td>
          <td class="kfs-td" id="data">${loan_no}</td>
        </tr>
        <tr>
          <td class="kfs-td">(b)</td>
          <td class="kfs-td" id="data">Full name</td>
          <td class="kfs-td" id="data">${full_name}</td>
        </tr>
        <tr>
          <td class="kfs-td">(c)</td>
          <td class="kfs-td" id="data">Sanction Loan Amount</td>
          <td class="kfs-td" id="data">₹ ${loan_amount}</td>
        </tr>
        <tr>
          <td class="kfs-td">(d)</td>
          <td class="kfs-td" id="data">ROI (% per day)</td>
          <td class="kfs-td" id="data">${roi}%</td>
        </tr>
        <tr>
          <td class="kfs-td">(e)</td>
          <td class="kfs-td" id="data">
            Total Interest charge during the entire Tenure of the loan
          </td>
          <td class="kfs-td" id="data">₹ ${interest_amount}</td>
        </tr>
        <tr>
          <td class="kfs-td">(f)</td>
          <td class="kfs-td" id="data">Processing Fee at 15%</td>
          <td class="kfs-td" id="data">₹ ${pf_amount}</td>
        </tr>
        <tr>
          <td class="kfs-td">(g)</td>
          <td class="kfs-td" id="data">
            <div style="width: 100%; height: 10%">
              GST on Processing Fee at 18%
            </div>
            <span style="font-size: 6px">* Please refer T&Cs</span>
          </td>
          <td class="kfs-td" id="data">₹ ${gst}</td>
        </tr>
        <tr>
          <td class="kfs-td">(h)</td>
          <td class="kfs-td" id="data">Total Fees (f + g)</td>
          <td class="kfs-td" id="data">₹ ${total_admin_fee}</td>
        </tr>
        <tr>
          <td class="kfs-td">(i)</td>
          <td class="kfs-td" id="data">Net Disbursed Amount</td>
          <td class="kfs-td" id="data">₹ ${net_disbursal}</td>
        </tr>
        <tr>
          <td class="kfs-td">(j)</td>
          <td class="kfs-td" id="data">Total Repayment Amount</td>
          <td class="kfs-td" id="data">₹ ${repayment_amount}</td>
        </tr>
        <tr>
          <td class="kfs-td">(k)</td>
          <td class="kfs-td" id="data">Repayment Date</td>
          <td class="kfs-td" id="data">${formattedRepaymentDate}</td>
        </tr>
        <tr>
          <td class="kfs-td">(l)</td>
          <td class="kfs-td" id="data">Tenure of the Loan (in Days)</td>
          <td class="kfs-td" id="data">${tenure} Days</td>
        </tr>
        <tr>
          <td class="kfs-td">(m)</td>
          <td class="kfs-td" id="data">Repayment Frequency</td>
          <td class="kfs-td" id="data">One Time Only</td>
        </tr>
        <tr>
          <td class="kfs-td">(n)</td>
          <td class="kfs-td" id="data">Number of installments of Repayment</td>
          <td class="kfs-td" id="data">1</td>
        </tr>
        <tr>
          <td class="kfs-td">(o)</td>
          <td class="kfs-td" id="data">Annual Percentage Rate (APR)</td>
          <td class="kfs-td" id="data">${apr}%</td>
        </tr>
        <!-- <tr>
                    <td class="kfs-td">(XIV)</td>
                    <td class="kfs-td" id="data">
                        Amount of each installment of repayment (in ₹)
                    </td>
                    <td class="kfs-td" id="data">(IX)</td>
                </tr> -->
        <tr>
          <td class="kfs-td" colspan="12">
            <strong>Details about Contingent Charges</strong>
          </td>
        </tr>
        <tr>
          <td class="kfs-td">(p)</td>
          <td class="kfs-td" id="data">
            Rate of annualized penal charges in case of delayed payments (if
            any)
          </td>
          <td class="kfs-td" id="data">2% Per Day</td>
        </tr>
        <tr>
          <td class="kfs-td" colspan="12">
            <strong>Disclosures</strong>
          </td>
        </tr>
        <tr>
          <td class="kfs-td">(q)</td>
          <td class="kfs-td" id="data">
            Cooling period during which borrower shall not be charged any
            penalty on prepayment of Loan
          </td>
          <td class="kfs-td" id="data">1 Day</td>
        </tr>
        <tr>
          <td class="kfs-td">(r)</td>
          <td class="kfs-td" id="data">
            Name, designation, address, and contact number of the nodal
            grievance redressal officer appointed specifically to handle FinTech
            or digital lending-related complaints and issues
          </td>
          <td class="kfs-td" id="data">
            Gaurav Kalra<br />Email: nodal@blinkrloan.com<br />Mobile:
            8800040798<br />Address: MGF Metropolis Mall, Metro Station, Near,
            Mehrauli-Gurgaon Rd, Sector 28, Maruti Housing Colony, Gurugram,
            Sarhol, Haryana 122002
          </td>
        </tr>
      </table>

      <div class="terms-conditions">
        <h2>TERMS AND CONDITIONS</h2>
        <p>
          The Borrower confirms to have read and understood these Terms of
          Agreement before accepting a personal loan ("Loan") offer with us. By
          clicking on the Esign button using Aadhar OTP and Digital Esign, the
          Borrower shall be deemed to have electronically accepted these Terms
          of Agreement. To the extent of any inconsistency, these Terms of
          Agreement shall prevail.
        </p>

        <ol>
          <li>
            The Loan shall carry a fixed rate of interest specified at the time
            of applying for the loan.
          </li>
          <li>
            The Loan amount shall be disbursed, after debiting processing fees,
            in Borrower's account only with the Bank on accepting the Personal
            Loan Terms of Agreement.
          </li>
          <li>
            The repayment amount shall consist of principal and interest
            components. The Borrower confirms to repay the repayment amount on
            the specified repayment date.
          </li>
          <li>
            If repayment is not done by the specified date, the Borrower will be
            liable for Late Payment Charges.
          </li>
          <li>
            If any repayment thru online or physical mode is not honored, the
            Borrower will be liable for dishonor charges, Penalty and Late
            Payment Charges including Interest.
          </li>
          <li>
            The Borrower agrees to pay the processing fee, payment dishonor
            charges, etc.
          </li>
          <li>
            Any overdue payment incurs interest at the Late Payment Charges rate
            (which is higher than the usual interest rate). We may change the
            interest rate if required by the statutory/regulatory authority.
          </li>
          <li>
            The Borrower agrees that fees and charges specified may be revised
            from time to time and binding on the Borrower.
          </li>
          <li>The Borrower agrees to pay applicable Goods and Service Tax.</li>
          <li>
            Loan Insured by ICICI Lombard General Insurance Company Limited and
            Borrower agreed to pay the mentioned Premium with GST as per Key
            Fact Statement to BlinkR Loan (Dev-Aashish Capitals Private
            Limited). Borrower Confirms that Dev-Aashish Capitals Private
            Limited (NBFC) and affiliated Loan Product (BlinkR Loan) is entitled
            to claim Loan Insurance amount directly from Insurance Provider
            (ICICI Lombard General Insurance Company Limited). Borrower agrees
            to present any/all the required valid documents/proof of Documents
            by Dev-Aashish Capitals Private Limited.
          </li>
        </ol>

        <table class="kfs-table">
          <tr>
            <th>Section</th>
            <th>Category</th>
            <th>Sub sections</th>
          </tr>
          <tr>
            <td>1</td>
            <td>Loss of job</td>
            <td>Involuntary unemployment, Merger & acquisition.</td>
          </tr>
          <tr>
            <td>2</td>
            <td>Cyber frauds</td>
            <td>
              Unauthorized transactions: Bank account, credit/debit cards, e
              wallets. Cyber frauds occurring through borrower's bank account,
              credit/debit cards for loss amount> INR 1 lakh
            </td>
          </tr>
          <tr>
            <td>3</td>
            <td>Home Protect</td>
            <td>
              Home Building and Household Assets, Natural calamities such as
              earthquakes, cyclones and flood. Fire and allied perils
            </td>
          </tr>
          <tr>
            <td>4</td>
            <td>Family emergency</td>
            <td>
              Accidental Death, Permanent disablement, Illness/Injury resulting
              in hospitalization of borrower for a minimum of 10 days
            </td>
          </tr>
        </table>

        <h3>Borrower Representations</h3>
        <p>The Borrower represents and covenants that the Borrower:</p>
        <ul>
          <li>will use the Loan amount for legitimate purposes.</li>
          <li>
            will not use the Loan for any speculative, antisocial, or prohibited
            purposes. If the Loan funds have been used for purposes as stated
            above, we shall be entitled to do all acts and things that we deem
            necessary to comply with its policies. The Borrower agrees to bear
            all costs and expenses incurs as a result thereof.
          </li>
          <li>
            shall notify, within 7 calendar days, if any information given by
            the Borrower changes. In the specific event of a change in address
            due to relocation or any other reason, the Borrower shall intimate
            the new address as soon as possible but no later than 15 days of
            such a change.
          </li>
          <li>
            information of the Borrower with us is correct, complete, and
            updated.
          </li>
          <li>
            has read and understood the Privacy Policy available on our website.
          </li>
        </ul>

        <h3>Notice</h3>
        <p>
          We may send Loan-related notices, statements, or any other
          communication to the Borrower by in-app messages, short message system
          (SMS), Whatsapp messaging service, electronic mail, ordinary prepaid
          post, or personal delivery to Borrower's registered communication &
          alternate addresses. Communication and notices sent by in-app
          messages/facsimile/SMS/email will be considered to have been sent and
          received by the Borrower on the same day irrespective of carrier
          delays. Communication and notices sent by pre-paid mail will be
          considered to have been delivered on the day immediately after the
          date of posting.
        </p>

        <h3>Consent to Disclose</h3>
        <ul>
          <li>
            The Borrower has no objection in and gives consent for sharing Loan
            details including Borrower's personal details to branches,
            affiliates, services providers, agents, contractors, surveyors,
            agencies, credit bureaus, etc. in or outside India, to enable us to
            provide services under the arrangement with the third parties
            including customized solutions and marketing services. The Borrower
            confirms that the authorization given above shall be valid till
            written communication of withdrawal of Borrower's consent is
            acknowledged by us.
          </li>
          <li>
            The Borrower understands and accepts the risks involved in sharing
            personal information including sensitive personal information like
            account details with a third party.
          </li>
          <li>
            The Borrower consents to share Borrower's personal information with
            third parties for processing, statistical or risks analysis,
            conducting credit or anti-money laundering checks, designing
            financial services or related products, marketing financial services
            or related products, customer recognition on our website/app,
            offering relevant product and service offers to customers, etc.
          </li>
          <li>
            The Borrower agrees that we may disclose Borrower's information to
            the Reserve Bank of India, other statutory/regulatory authorities,
            arbitrator, credit bureaus, local authorities, credit rating agency,
            information utility, marketing agencies, and service providers if
            required.
          </li>
          <li>
            The Borrower authorizes to provide monthly details of the Loan
            Account and the credit facilities extended to the Borrower to credit
            information companies. We may obtain information on credit
            facilities availed by the Borrower from other financial institutions
            to determine whether we can extend additional credit facilities. On
            the regularization of the Borrowers account, we will update the
            credit information companies accordingly.
          </li>
          <li>
            The Borrower authorizes to verify any of the information of the
            Borrower including Borrower's credit standing from anyone we may
            consider appropriate including credit bureaus, local authority,
            credit rating agencies etc.
          </li>
          <li>
            The Borrower authorizes us to inform Borrower's employer of any
            default in repayment and agrees to do things necessary to fulfill
            Borrower's obligations.
          </li>
          <li>
            Our records about the Loan shall be conclusive and binding on the
            Borrower.
          </li>
          <li>
            In case of default in repayment of the Loan amount, Borrower
            authorizes us and our collection assistance specialist/executives to
            contact Borrower over phone, whatsapp, Messaging, IVR calling,
            Office and Borrower's residence physical visits including alternate
            addresses where Borrower is located.
          </li>
        </ul>

        <h3>Effective Date</h3>
        <p>
          These Terms of Agreement shall be effective from the date of disbursal
          of the loan amount.
        </p>

        <h3>Assignment</h3>
        <p>
          The Borrower agrees that, with or without intimation to the Borrower,
          be authorized to sell and /or assign to any third party, the Loan and
          all outstanding dues under this Agreement, in any manner, in whole or
          in part, and on such terms as we may decide. Any such sale or
          assignment shall bind the Borrower, and the Borrower shall accept the
          third party as its sole creditor or creditor jointly with us and in
          such event, the Borrower shall pay us or such creditor or as we may
          direct, the outstanding amounts due from the Borrower under this
          Agreement.
        </p>

        <h3>Governing Law & Jurisdiction</h3>
        <p>
          The Loan shall be governed by the laws of India and all claims and
          disputes arising out of or in connection with the Loan shall be
          settled by arbitration. Any arbitration award/ direction passed shall
          be final and binding on the parties. The language of the arbitration
          shall be English/Hindi and the venue of such arbitration shall be in
          New Delhi.
        </p>
      </div>
    </div>
    <div class="footer-wrapper">
      <img src="${footerImageBase64}" alt="Footer" class="footer-img" />
    </div>
  </body>
</html>
  `
};


export default generateLoanHTML;

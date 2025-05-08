import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    try {
        const leadData = generateLeadDataArray(100);
        await prisma.lead.createMany({
            data: leadData,
            skipDuplicates: true, // Avoid duplicate entries
        });

        console.log("✅ Database seeded successfully!");
    } catch (error) {
        console.error("❌ Error seeding database:", error);
    } finally {
        await prisma.$disconnect();
    }
}

const sources = ["marketnig", "blinkr"]; // <-- lowercase string values

function generateLeadData(index) {
    const fNames = ["Neha", "Rahul", "Priya", "Amit", "Sneha", "Vikram", "Anjali", "Deepak", "Kavita", "Rohan"];
    const lNames = ["Gupta", "Sharma", "Patel", "Singh", "Kumar", "Verma", "Yadav", "Joshi", "Chauhan", "Mehta"];
    const genders = ["M", "F"];
    const panChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let pan = "";
    for (let i = 0; i < 10; i++) {
        pan += panChars.charAt(Math.floor(Math.random() * panChars.length));
    }
    const aadhaar = String(Math.floor(Math.random() * 900000000000) + 100000000000);
    const mobile = String(Math.floor(Math.random() * 9000000000) + 1000000000);
    const loanAmount = Math.floor(Math.random() * 1000000) + 100000;
    const tenure = Math.floor(Math.random() * 36) + 12;
    const dpd = Math.floor(Math.random() * 30);
    const dobYear = Math.floor(Math.random() * 30) + 1970;
    const dobMonth = Math.floor(Math.random() * 12);
    const dobDay = Math.floor(Math.random() * 28) + 1;
    const leadNo = `LD${String(index + 1).padStart(3, "0")}`;
    const fName = fNames[Math.floor(Math.random() * fNames.length)];
    const lName = lNames[Math.floor(Math.random() * lNames.length)];
    const fullName = `${fName} ${lName}`;
    const gender = genders[Math.floor(Math.random() * genders.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];
    const personalEmail = `${fName.toLowerCase()}.${lName.toLowerCase()}@email.com`;
    const dob = new Date(dobYear, dobMonth, dobDay);

    const isBreReject = index < 50; // First 50 = true, rest = false

    return {
        lead_no: leadNo,
        f_name: fName,
        l_name: lName,
        full_name: fullName,
        pan: pan,
        gender: gender,
        dob: dob,
        aadhaar: aadhaar,
        loan_amount: loanAmount,
        is_bre_reject: isBreReject,
        tenure: tenure,
        dpd: dpd,
        mobile: mobile,
        personal_email: personalEmail,
        allocated_to: null,
        lead_stage: "PENDING_LEAD",
        source: source,
        created_at: new Date(),
        updated_at: new Date(),
    };
}


function generateLeadDataArray(count) {
    const leads = [];
    for (let i = 0; i < count; i++) {
        leads.push(generateLeadData(i));
    }
    return leads;
}

main();

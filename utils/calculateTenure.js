export const calculateRepaymentDate = (salaryDateInput) => {
    const MS_PER_DAY = 86400000; // 24 * 60 * 60 * 1000
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Process salary date
    const salaryDate = new Date(salaryDateInput);
    salaryDate.setFullYear(today.getFullYear(), today.getMonth(), salaryDate.getDate());
    salaryDate.setHours(0, 0, 0, 0);

    // Adjust to next month if date is in past
    if (salaryDate < today) {
        salaryDate.setMonth(salaryDate.getMonth() + 1);
    }

    // Calculate days difference
    const diffDays = Math.ceil((salaryDate - today) / MS_PER_DAY);
    let tenure;

    // Calculate tenure using pure mathematics
    if (diffDays <= 7) {
        const potentialTenure = diffDays + 30;
        tenure = potentialTenure <= 45 ? potentialTenure : 7;
    } else {
        tenure = Math.min(diffDays, 45);
    }

    // Calculate final repayment date
    const repaymentDate = new Date(today.getTime() + (tenure * MS_PER_DAY));

    return {
        repaymentDate,
        tenure
    };
}
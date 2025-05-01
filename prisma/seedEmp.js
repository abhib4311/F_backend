import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
async function seed() {
    try {
        // 1️⃣ Insert Roles
        const roles = await prisma.role.createMany({
            data: [
                { role_name: 'SCREENER' },
                { role_name: 'ADMIN' },
                { role_name: 'CREDIT-ANALYST' },
                { role_name: 'DISBURSAL-HEAD' },
                { role_name: 'MARKETING' },
                { role_name: 'COLLECTION' },
            ],
            skipDuplicates: true,
        });

        console.log('✅ Roles inserted');

        // 2️⃣ Insert Employees
        const passwordHash = await bcrypt.hash('123', 10);

        const employees = await prisma.employee.createMany({
            data: [
                {
                    emp_id: 'EMP-001',
                    f_name: 'Screener',
                    l_name: 'User',
                    email: 'screener@1',
                    password: passwordHash,
                    gender: 'M',
                    mobile: '9876543210',
                    is_logged_in: false,
                },
                {
                    emp_id: 'EMP-002',
                    f_name: 'Admin',
                    l_name: 'User',
                    email: 'admin@1',
                    password: passwordHash,
                    gender: 'M',
                    mobile: '9876543211',
                    is_logged_in: false,
                },
                {
                    emp_id: 'EMP-003',
                    f_name: 'Credit',
                    l_name: 'Analyst',
                    email: 'credit@1',
                    password: passwordHash,
                    gender: 'M',
                    mobile: '9876543212',
                    is_logged_in: false,
                },
                {
                    emp_id: 'EMP-004',
                    f_name: 'Disbursal',
                    l_name: 'Head',
                    email: 'disbursal@1',
                    password: passwordHash,
                    gender: 'M',
                    mobile: '9876543213',
                    is_logged_in: false,
                },
                {
                    emp_id: 'EMP-005',
                    f_name: 'Marketing',
                    l_name: 'User',
                    email: 'marketing@1',
                    password: passwordHash,
                    gender: 'M',
                    mobile: '9876543214',
                    is_logged_in: false,
                },
                {
                    emp_id: 'EMP-006',
                    f_name: 'Collection',
                    l_name: 'User',
                    email: 'collection@1',
                    password: passwordHash,
                    gender: 'M',
                    mobile: '9876543215',
                    is_logged_in: false,
                },
            ],
            skipDuplicates: true,
        });

        console.log('✅ Employees inserted');

        // 3️⃣ Assign Roles to Employees
        const employeeRoles = [
            { emp_id: 'EMP-001', role_name: 'SCREENER' },
            { emp_id: 'EMP-002', role_name: 'ADMIN' },
            { emp_id: 'EMP-003', role_name: 'CREDIT-ANALYST' },
            { emp_id: 'EMP-004', role_name: 'DISBURSAL-HEAD' },
            { emp_id: 'EMP-005', role_name: 'MARKETING' },
            { emp_id: 'EMP-006', role_name: 'COLLECTION' },
        ];

        for (const { emp_id, role_name } of employeeRoles) {
            const employee = await prisma.employee.findUnique({ where: { emp_id } });
            const role = await prisma.role.findUnique({ where: { role_name } });

            if (employee && role) {
                await prisma.employee_Role.create({
                    data: {
                        employee_id: employee.id,
                        role_id: role.id,
                    },
                });
            }
        }

        console.log('✅ Employee roles assigned');

        // 4️⃣ Insert Employee Logs
        const logs = await prisma.employee_Logs.createMany({
            data: [
                { employee_id: 1, remarks: 'Screener logged in' },
                { employee_id: 2, remarks: 'Admin logged in' },
                { employee_id: 3, remarks: 'Credit Analyst logged in' },
                { employee_id: 4, remarks: 'Disbursal Head logged in' },
                { employee_id: 5, remarks: 'Marketing User logged in' },
                { employee_id: 6, remarks: 'Collection User logged in' },
            ],
        });

        console.log('✅ Employee logs inserted');

    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

seed();
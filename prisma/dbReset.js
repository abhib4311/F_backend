import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDatabase() {
  try {
    // Disable foreign key checks
    await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 0;`);

    // List of models to delete data from
    const modelsToClear = [
      'Lead_Logs',
      'Transaction_History',
      'Document',
      'Api_Logs',
      'Payment',
      'Collection',
      'Disbursal',
      'Sanction',
      'Customer',
      'Lead',
      'feedback_form',
      'references',
      'Bank_Statement_Report',
      'customer_address',
      'Bank_Details',
      'Employee_Logs',
      'Counter'
    ];

    // Delete data from each model
    for (const model of modelsToClear) {
      await prisma.$executeRawUnsafe(`DELETE FROM ${model};`);
      console.log(`Cleared table ${model}`);
    }

    // Re-enable foreign key checks
    await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 1;`);

    console.log('Database cleared except serviceable_pin_code, blacklisted_pan, Employee, Role, Employee_Role');
  } catch (error) {
    console.error('Error clearing database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();

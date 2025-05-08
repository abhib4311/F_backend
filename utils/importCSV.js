import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CHUNK_SIZE = 2000; // Adjust based on your database capacity

const processFile = {
    csv: async (filePath, transformFn, model) => {
        let batch = [];
        let count = 0;

        await new Promise((resolve, reject) => {
            const stream = fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    try {
                        batch.push(transformFn(row));

                        if (batch.length >= CHUNK_SIZE) {
                            stream.pause();

                            model.createMany({
                                data: batch,
                                skipDuplicates: true,
                            })
                                .then(() => {
                                    count += batch.length;
                                    batch = [];
                                    stream.resume();
                                })
                                .catch(err => {
                                    stream.destroy();
                                    reject(err);
                                });
                        }
                    } catch (transformErr) {
                        stream.destroy();
                        reject(transformErr);
                    }
                })
                .on('end', async () => {
                    try {
                        if (batch.length > 0) {
                            await model.createMany({
                                data: batch,
                                skipDuplicates: true,
                            });
                            count += batch.length;
                        }
                        console.log(`✅ ${path.basename(filePath)}: Imported ${count} records`);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                })
                .on('error', reject);
        });
    },

    xlsx: async (filePath, transformFn, model) => {
        try {
            const workbook = xlsx.readFile(filePath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = xlsx.utils.sheet_to_json(sheet);

            const data = rows.map(row => {
                try {
                    return transformFn(row);
                } catch (err) {
                    throw new Error(`Transform error in row ${rows.indexOf(row)}: ${err.message}`);
                }
            });

            let imported = 0;
            const totalRows = data.length;

            while (imported < totalRows) {
                const chunk = data.slice(imported, imported + CHUNK_SIZE);

                try {
                    await model.createMany({
                        data: chunk,
                        skipDuplicates: true,
                    });
                    imported += chunk.length;
                    console.log(`🔄 ${path.basename(filePath)}: Processed ${imported}/${totalRows}`);
                } catch (err) {
                    throw new Error(`Failed to insert chunk ${imported}-${imported + CHUNK_SIZE}: ${err.message}`);
                }
            }

            console.log(` ${path.basename(filePath)}: Completed ${imported} records`);
        } catch (err) {
            throw new Error(`XLSX processing failed: ${err.message}`);
        }
    }
};

const importData = async () => {
    try {
        await prisma.$connect();

        // Process Blacklisted PAN (CSV)
        await processFile.csv(
            './utils/blacklisted_pan.csv',
            (row) => ({
                pan: row.pancard?.trim(),
                customer_name: row.customer_name?.trim(),
                reason: row.reason?.trim() || null,
                dpd: row.dpd || "",
            }),
            prisma.blacklisted_pan
        );

        // Process Pincodes (XLSX)
        await processFile.xlsx(
            './utils/PINCODE MASTER.xlsx',
            (row) => ({
                pincode: String(row.Pincode?.toString().trim()),
                district: row.DISTRICT?.trim(),
                state: row.STATE?.trim(),
                firstTwo: parseInt(row["FIRST TWO"], 10) || 0,
            }),
            prisma.serviceable_pin_code
        );

        // Process Whitelisted (CSV)
        await processFile.csv(
            './utils/whitelisted_users.csv', 
            (row) => ({
                customer_name: row.customer_name?.trim(),
                pan: row.pan?.trim(),
                previous_loan_amount: parseInt(row.amount) || 0,
            }),
            prisma.whitelisted_users 
        );

    } catch (err) {
        Imported
        console.error(' Import failed:', err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
};

// Execute imports
importData()
    .then(() => console.log('🏁 All imports completed successfully'))
    .catch(() => process.exit(1));

// for truncate the table
// await prisma.$executeRawUnsafe(`TRUNCATE TABLE blacklisted_pan`);

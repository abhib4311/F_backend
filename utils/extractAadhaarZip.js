import axios from "axios";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import xml2js from "xml2js";
import { createCanvas, loadImage } from "canvas";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const extractAadhaarZip = async (zipUrl, password, pan) => {
  const zipFileName = "aadhaar.zip";
  const zipPath = path.join(__dirname, zipFileName);
  const outputDir = path.join(__dirname, "aadhaar_extracted");

  if (!fs.existsSync(path.dirname(zipPath))) {
    fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const response = await axios.get(zipUrl, { responseType: "stream" });
    const writer = fs.createWriteStream(zipPath);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    execSync(`unzip -P "${password}" -o "${zipPath}" -d "${outputDir}"`);

    const files = fs.readdirSync(outputDir);
    for (const file of files) {
      const filePath = path.join(outputDir, file);
      if (file.endsWith(".xml")) {
        const xmlData = fs.readFileSync(filePath, "utf-8");
        const result = await xml2js.parseStringPromise(xmlData);

        const uidData = result.OfflinePaperlessKyc.UidData[0];
        const poi = uidData.Poi[0].$;
        const poa = uidData.Poa[0].$;
        const photoBase64 = uidData.Pht[0];

        // --- Create Aadhaar-style image ---
        const width = 900;
        const height = 550;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");

        // White background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);

        // Header - Tricolor
        ctx.fillStyle = "#FF9933";
        ctx.fillRect(0, 0, width, 20);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 20, width, 20);
        ctx.fillStyle = "#138808";
        ctx.fillRect(0, 40, width, 20);

        // Government of India
        ctx.fillStyle = "#000000";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText("भारत सरकार", 20, 80);
        ctx.fillText("Government of India", 20, 105);

        // User Photo
        const imgBuffer = Buffer.from(photoBase64, "base64");
        const image = await loadImage(imgBuffer);
        ctx.drawImage(image, 30, 140, 130, 160);

        // User Information
        ctx.fillStyle = "#000000";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(poi.name, 180, 150);
        ctx.fillText(`Name: ${poi.name}`, 180, 180);

        ctx.font = "16px sans-serif";
        ctx.fillText(`DOB: ${poi.dob}`, 180, 215);
        ctx.fillText(`Gender: ${poi.gender.toUpperCase()}`, 180, 245);

        if (poa.careof) {
          ctx.fillText(`S/O: ${poa.careof}`, 180, 275);
        }

        // Address (2 lines)
        const addressLine1 = `${poa.house || ""}, ${poa.street || ""}, ${poa.loc || ""}, ${poa.vtc || ""}`;
        const addressLine2 = `${poa.dist || ""}, ${poa.state || ""} - ${poa.pc || ""}`;
        ctx.fillText(`Address: ${addressLine1}`, 180, 305);
        ctx.fillText(addressLine2, 180, 330);

        // Aadhaar Number (only show last 4 digits)
        const maskedUID = "XXXX XXXX " + poi.uid?.slice(-4);
        ctx.font = "bold 28px sans-serif";
        ctx.fillText(maskedUID, 30, 400);

        // VID (optional)
        ctx.font = "14px sans-serif";
        ctx.fillText("VID: XXXX XXXX XXXX XXXX", 30, 430);

        // Tagline
        ctx.fillStyle = "#000080";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText("मेरा आधार, मेरी पहचान", 30, 470);

        // Save image
        const outputPath = path.join(outputDir, `${pan}.jpg`);
        const outStream = fs.createWriteStream(outputPath);
        const stream = canvas.createJPEGStream({ quality: 0.95 });
        stream.pipe(outStream);

        await new Promise((resolve) => outStream.on("finish", resolve));

        return outputPath;
      }
    }

    return null;
  } catch (err) {
    console.error("❌ Error:", err.message);
    return null;
  }
};

export { extractAadhaarZip };


















// import axios from "axios";
// import fs from "fs";
// import path from "path";
// import { execSync } from "child_process";
// import xml2js from "xml2js";
// import { createCanvas, loadImage } from "canvas";

// const __dirname = path.dirname(new URL(import.meta.url).pathname);

// const extractAadhaarZip = async (zipUrl, password, pan) => {
//   const zipFileName = "aadhaar.zip";
//   const zipPath = path.join(__dirname, zipFileName);
//   const outputDir = path.join(__dirname, "aadhaar_extracted");

//   if (!fs.existsSync(path.dirname(zipPath))) {
//     fs.mkdirSync(path.dirname(zipPath), { recursive: true });
//   }
//   if (!fs.existsSync(outputDir)) {
//     fs.mkdirSync(outputDir, { recursive: true });
//   }

//   try {
//     const response = await axios.get(zipUrl, { responseType: "stream" });
//     const writer = fs.createWriteStream(zipPath);
//     response.data.pipe(writer);
//     await new Promise((resolve, reject) => {
//       writer.on("finish", resolve);
//       writer.on("error", reject);
//     });

//     execSync(`unzip -P "${password}" -o "${zipPath}" -d "${outputDir}"`);

//     const files = fs.readdirSync(outputDir);
//     for (const file of files) {
//       const filePath = path.join(outputDir, file);
//       if (file.endsWith(".xml")) {
//         const xmlData = fs.readFileSync(filePath, "utf-8");
//         const result = await xml2js.parseStringPromise(xmlData);

//         const uidData = result.OfflinePaperlessKyc.UidData[0];
//         const poi = uidData.Poi[0].$;
//         const poa = uidData.Poa[0].$;
//         const photoBase64 = uidData.Pht[0];

//         // Create image canvas
//         const width = 600;
//         const height = 400;
//         const canvas = createCanvas(width, height);
//         const ctx = canvas.getContext("2d");

//         // White background
//         ctx.fillStyle = "#FFFFFF";
//         ctx.fillRect(0, 0, width, height);

//         // Draw text
//         ctx.fillStyle = "#000000";
//         ctx.font = "16px sans-serif";
//         ctx.fillText(`Name: ${poi.name}`, 20, 40);
//         ctx.fillText(`DOB: ${poi.dob}`, 20, 70);
//         ctx.fillText(`Gender: ${poi.gender}`, 20, 100);
//         ctx.fillText(`S/O: ${poa.careof}`, 20, 130);
//         ctx.fillText(`Address: ${poa.house}, ${poa.street}, ${poa.loc}, ${poa.vtc}`, 20, 160);
//         ctx.fillText(`${poa.dist}, ${poa.state} - ${poa.pc}`, 20, 190);

//         // Embed Aadhaar image
//         const imgBuffer = Buffer.from(photoBase64, "base64");
//         const image = await loadImage(imgBuffer);
//         ctx.drawImage(image, 420, 40, 120, 120);

//         // Save JPEG
//         const outputPath = path.join(outputDir, `${pan}.jpg`);
//         const outStream = fs.createWriteStream(outputPath);
//         const stream = canvas.createJPEGStream({ quality: 0.95 });
//         stream.pipe(outStream);

//         await new Promise((resolve) => outStream.on("finish", resolve));

//         // console.log("🖼️ Aadhaar image saved at:", outputPath);
//         return outputPath;
//       }
//     }

//     // console.warn("⚠️ No XML found in extracted zip.");
//     return null;
//   } catch (err) {
//     console.error("❌ Error:", err.message);
//     return null;
//   }
// };

// export { extractAadhaarZip };

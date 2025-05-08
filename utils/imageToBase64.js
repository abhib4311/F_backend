import fs from "fs";
import path from "path";

const getImageBase64 = (relativeImagePath) => {
  const imagePath = path.resolve(relativeImagePath);
  const imageData = fs.readFileSync(imagePath);
  return `data:image/png;base64,${imageData.toString("base64")}`;
};

export default getImageBase64;

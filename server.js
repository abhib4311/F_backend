import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import morgan from "morgan";
// import helmet from "helmet";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import xss from "xss-clean";
import crmroute from "./Routes/CRM/index.js";
import userRoutes from "./Routes/User/user.route.js";
import logger from "./utils/logger.js";
import { notFound, errorHandler } from "./Middlewares/errorMiddleware.js";
import "./utils/logReporter.js";

dotenv.config();

const app = express();

// ----------------------------
// SECURITY MIDDLEWARES
// ----------------------------
// app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV !== "test") {
  app.use(
    morgan(
      process.env.NODE_ENV === "production" ? "combined" : "dev",
      {
        stream: {
          write: (message) => logger.http(message.trim() + "------------ " + new Date().toISOString()),
        },
      }
    )
  );
}
var corsOption = {
  origin: [
    "https://www.crm.fundobaba.com",
    "https://www.crm.fundobaba.com/",
    "https://crm.fundobaba.com",
    "https://crm.fundobaba.com/",
    "https://blinkrloan.com",
    "https://www.blinkrloan.com",
    "https://149.5.61.77",
    "http://localhost:5173",
    "https://fundobaba.com",
    "https://www.fundobaba.com",
    "https://www.fundobaba.com/",
    "http://192.168.218.96:5173",
    "http://192.168.218.96:5173/",
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_DEV
  ],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOption));
app.use(xss());
app.use(hpp());

// ----------------------------
// RATE LIMITING
// ----------------------------
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: "Too many requests from this IP, please try again later"
});
app.use("/api/", limiter);

// ----------------------------
// BODY & FILE PARSERS
// ----------------------------


// ----------------------------
// PERFORMANCE OPTIMIZATION
// ----------------------------
// app.use(compression());

// ----------------------------
// HTTP REQUEST LOGGING
// ----------------------------


// -------------------------------------
// STATIC ASSETS (Example usage of path)
// -------------------------------------
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "public")));  // Public folder
app.use("/uploads", express.static(path.join(__dirname, "/uploads")));  // Uploads directory

// ----------------------------
// ROUTES
// ----------------------------
app.get("/", (req, res) => res.send("Hi from LOS backend server 14"));
app.use("/api/user", userRoutes);
app.use("/api/crm", crmroute);

// ----------------------------
// ERROR HANDLING
// ----------------------------
app.use(notFound);
app.use(errorHandler);

// ----------------------------
// SERVER START
// ----------------------------
const PORT = process.env.PORT || 8001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
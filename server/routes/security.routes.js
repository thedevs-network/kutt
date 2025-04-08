const { Router } = require("express");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();

// Endpoint to handle CSP violation reports
router.post("/report-violation", asyncHandler(async (req, res) => {
  // Log the violation to console in development
  if (process.env.NODE_ENV !== "production") {
    console.error("CSP Violation:", req.body);
  }
  
  // In a production environment, you would want to log this to a file or database
  // For now, we'll just acknowledge receipt of the report
  res.status(204).end();
}));

module.exports = router; 
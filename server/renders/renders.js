const { Router } = require("express");

const router = Router();

router.get("/", function homepage(req, res) {
  console.log(req.cookies);
  res.render("homepage", {
    title: "Modern open source URL shortener"
  });
});

router.get("/login", function login(req, res) {
  res.render("login", {
    title: "Log in or sign up"
  });
});

module.exports = router;

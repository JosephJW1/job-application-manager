const express = require("express");
const app = express();
const cors = require("cors");

app.use(express.json());
app.use(cors());

const db = require("./models");

// Routers
const authRouter = require("./routes/Auth");
app.use("/auth", authRouter);

const experienceRouter = require("./routes/Experiences");
app.use("/experiences", experienceRouter);

const jobRouter = require("./routes/Jobs");
app.use("/jobs", jobRouter);

// Using one router for the simpler lists to keep things clean
const listsRouter = require("./routes/Lists");
app.use("/lists", listsRouter);

db.sequelize.sync({ alter: true }).then(() => {
  app.listen(3001, () => {
    console.log("Server running on port 3001");
  });
});
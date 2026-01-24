const express = require("express");
const router = express.Router();
const { Skill, JobTag } = require("../models");
const { validateToken } = require("../middlewares/AuthMiddleware");

// --- SKILLS ---
router.get("/skills", async (req, res) => {
  const list = await Skill.findAll();
  res.json(list);
});

router.post("/skills", validateToken, async (req, res) => {
  try {
    const item = await Skill.create(req.body);
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// [NEW] Allow renaming a skill
router.put("/skills/:id", validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await Skill.update(req.body, { where: { id } });
    res.json({ message: "Updated" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/skills/:id", validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await Skill.destroy({ where: { id } });
    res.json({ message: "Deleted" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- JOB TAGS ---
router.get("/jobtags", async (req, res) => {
  const list = await JobTag.findAll();
  res.json(list);
});

router.post("/jobtags", validateToken, async (req, res) => {
  try {
    const item = await JobTag.create(req.body);
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/jobtags/:id", validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await JobTag.destroy({ where: { id } });
    res.json({ message: "Deleted" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
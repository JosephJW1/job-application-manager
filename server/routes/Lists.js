const express = require("express");
const router = express.Router();
const { Skill, JobTag, ExpSkillDemo, Requirement } = require("../models");
const { validateToken } = require("../middlewares/AuthMiddleware");

// --- SKILLS ---
router.get("/skills", async (req, res) => {
  const list = await Skill.findAll();
  res.json(list);
});

// Get usage counts for a skill
router.get("/skills/:id/usage", validateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const experienceCount = await ExpSkillDemo.count({
      where: { SkillId: id }
    });

    const requirementCount = await Requirement.count({
      include: [{
        model: Skill,
        where: { id: id }, 
        required: true     
      }]
    });

    res.json({ experienceCount, requirementCount });
  } catch (e) {
    console.error("Usage Check Error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/skills", validateToken, async (req, res) => {
  try {
    const item = await Skill.create(req.body);
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Rename a skill
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

    // Handle ExpSkillDemo Preservation
    const demos = await ExpSkillDemo.findAll({ where: { SkillId: id } });
    
    for (const demo of demos) {
      if (demo.explanation && demo.explanation.trim() !== "") {
        demo.SkillId = null;
        await demo.save();
      } else {
        await demo.destroy();
      }
    }

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
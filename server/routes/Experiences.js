const express = require("express");
const router = express.Router();
const { Experience, ExpSkillDemo, Skill } = require("../models");
const { validateToken } = require("../middlewares/AuthMiddleware");

// GET ALL
router.get("/", validateToken, async (req, res) => {
  try {
    const list = await Experience.findAll({
      where: { UserId: req.user.id },
      include: [
        {
          model: ExpSkillDemo,
          as: "SkillDemonstrations",
          include: [{ model: Skill }] 
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE
router.post("/", validateToken, async (req, res) => {
  const { title, description, location, position, duration, skillDemonstrations } = req.body;
  
  try {
    const newExp = await Experience.create({ 
      title, 
      description, 
      location, 
      position, 
      duration,
      UserId: req.user.id 
    });
    
    if (skillDemonstrations && skillDemonstrations.length > 0) {
      const junctionPromises = skillDemonstrations.map((demo) => {
        if (!demo.skillId && (!demo.explanation || !demo.explanation.trim())) return null;
        
        return ExpSkillDemo.create({
          ExperienceId: newExp.id,
          SkillId: demo.skillId || null,
          explanation: demo.explanation || ""
        });
      });
      await Promise.all(junctionPromises);
    }
    
    res.json(newExp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// [NEW] REASSIGN SKILL FOR A DEMO
// Must come BEFORE "/:id"
router.put("/demo/:id", validateToken, async (req, res) => {
  const { id } = req.params; 
  const { SkillId } = req.body;
  
  try {
    const demo = await ExpSkillDemo.findByPk(id, {
      include: { model: Experience, attributes: ['UserId'] }
    });

    if (!demo) return res.status(404).json({ error: "Demonstration not found" });
    if (demo.Experience.UserId !== req.user.id) return res.status(403).json({ error: "Access denied" });

    // Check for duplicates in the same experience
    if (SkillId) {
      const duplicate = await ExpSkillDemo.findOne({
        where: {
          ExperienceId: demo.ExperienceId,
          SkillId: SkillId
        }
      });

      // If a record exists with this Skill and Experience, and it's not the one we are currently editing
      if (duplicate && duplicate.id !== demo.id) {
        return res.status(409).json({ error: "This skill is already listed for this experience. Please edit the existing entry instead." });
      }
    }

    await demo.update({ SkillId: SkillId || null });
    res.json(demo);
  } catch (error) {
    // Unique Constraint errors usually come here if not caught above
    if (error.name === 'SequelizeUniqueConstraintError') {
       return res.status(409).json({ error: "This skill is already listed for this experience." });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE SKILL DEMO BY ID (Primary Key)
router.delete("/demo/:id", validateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const demo = await ExpSkillDemo.findByPk(id, {
      include: { model: Experience, attributes: ['UserId'] }
    });
    if (!demo) return res.status(404).json({ error: "Not found" });
    if (demo.Experience.UserId !== req.user.id) return res.status(403).json({ error: "Access denied" });

    await demo.destroy();
    res.json({ message: "Deleted" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// UPDATE SPECIFIC SKILL DEMONSTRATION EXPLANATION
router.put("/:id/demo/:skillId", validateToken, async (req, res) => {
  const { id, skillId } = req.params; // id is ExperienceId
  const { explanation } = req.body;

  try {
    const experience = await Experience.findOne({ where: { id: id, UserId: req.user.id } });
    if (!experience) return res.status(404).json({ error: "Experience not found" });

    await ExpSkillDemo.update(
      { explanation: explanation },
      { where: { ExperienceId: id, SkillId: skillId } }
    );
    res.json({ message: "Demonstration updated" });
  } catch (error) {
    console.error("Error updating demo:", error);
    res.status(500).json({ error: error.message });
  }
});

// ADD SKILL DEMO TO EXPERIENCE
router.post("/:id/demo", validateToken, async (req, res) => {
  const { id } = req.params;
  const { skillId, explanation } = req.body;
  try {
    const experience = await Experience.findOne({ where: { id: id, UserId: req.user.id } });
    if (!experience) return res.status(404).json({ error: "Experience not found" });

    const item = await ExpSkillDemo.create({
      ExperienceId: id,
      SkillId: skillId,
      explanation: explanation || ""
    });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE SKILL DEMO FROM EXPERIENCE
router.delete("/:id/demo/:skillId", validateToken, async (req, res) => {
  const { id, skillId } = req.params;
  try {
    const experience = await Experience.findOne({ where: { id: id, UserId: req.user.id } });
    if (!experience) return res.status(404).json({ error: "Experience not found" });

    await ExpSkillDemo.destroy({
      where: { ExperienceId: id, SkillId: skillId }
    });
    res.json({ message: "Deleted" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// UPDATE EXPERIENCE (Full)
router.put("/:id", validateToken, async (req, res) => {
  const { id } = req.params;
  const { title, description, location, position, duration, skillDemonstrations } = req.body;

  try {
    const experience = await Experience.findOne({ where: { id: id, UserId: req.user.id } });
    if (!experience) return res.status(404).json({ error: "Experience not found" });

    await experience.update(
      { title, description, location, position, duration }
    );

    if (Array.isArray(skillDemonstrations)) {
      await ExpSkillDemo.destroy({ where: { ExperienceId: id } });
      
      if (skillDemonstrations.length > 0) {
        const junctionPromises = skillDemonstrations.map((demo) => {
          if (!demo.skillId && (!demo.explanation || !demo.explanation.trim())) return null;

          return ExpSkillDemo.create({
            ExperienceId: id,
            SkillId: demo.skillId || null, 
            explanation: demo.explanation || ""
          });
        });
        await Promise.all(junctionPromises);
      }
    }
    res.json({ message: "Updated Successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE
router.delete("/:id", validateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Experience.destroy({ where: { id: id, UserId: req.user.id } });
    if (!deleted) return res.status(404).json({ error: "Experience not found" });
    res.json({ message: "Deleted Successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
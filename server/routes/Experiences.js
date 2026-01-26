const express = require("express");
const router = express.Router();
const { Experience, ExpSkillDemo, Skill } = require("../models");
const { validateToken } = require("../middlewares/AuthMiddleware");

// GET ALL
router.get("/", async (req, res) => {
  try {
    const list = await Experience.findAll({
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
      title, description, location, position, duration 
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
    const demo = await ExpSkillDemo.findByPk(id);
    if (!demo) return res.status(404).json({ error: "Demonstration not found" });

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

// UPDATE SPECIFIC SKILL DEMONSTRATION EXPLANATION
router.put("/:id/demo/:skillId", validateToken, async (req, res) => {
  const { id, skillId } = req.params;
  const { explanation } = req.body;

  try {
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
    await Experience.update(
      { title, description, location, position, duration },
      { where: { id: id } }
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
    await Experience.destroy({ where: { id: id } });
    res.json({ message: "Deleted Successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;